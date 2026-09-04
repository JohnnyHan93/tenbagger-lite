import { uid, clamp } from "../utils.ts";
import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { researchStatusOf } from "./coverage-report.ts";
import {
  DEFAULT_CONCURRENCY,
  EXECUTE_FULL_100,
  FULL100_EXECUTION_DISABLED,
  MAX_JOB_ATTEMPTS,
  classifyQuoteFailure,
  isRetryableFailure,
  remainingUniverseJobs,
  type FailureClass,
  type JobStatus,
} from "./jobs.ts";
import type { ResearchJobRow, ResearchRunRow } from "../persist/queue.ts";
import { SAMPLE_RESEARCH_100_UNIVERSE_ID } from "../sample-research-100.ts";

export { FULL100_EXECUTION_DISABLED, DEFAULT_CONCURRENCY, MAX_JOB_ATTEMPTS };

export type ResearchOutcome =
  | { ok: true; company: Company; snapshot: Snapshot; provider?: string }
  | { ok: false; failureClass: FailureClass; error: string };

export interface JobStore {
  get(id: string): Promise<ResearchJobRow | null>;
  update(
    id: string,
    patch: Partial<
      Pick<
        ResearchJobRow,
        | "status"
        | "attemptCount"
        | "failureClass"
        | "provider"
        | "lastError"
        | "queuedAt"
        | "startedAt"
        | "completedAt"
        | "payload"
      >
    >,
  ): Promise<void>;
  list(runId: string): Promise<ResearchJobRow[]>;
}

export interface RunnerDeps {
  research: (ticker: string) => Promise<ResearchOutcome>;
  persist: (
    company: Company,
    snapshot: Snapshot,
    job: ResearchJobRow,
    status: JobStatus,
  ) => Promise<void>;
  jobs?: JobStore;
  sleep?: (ms: number) => Promise<void>;
  now?: () => string;
  concurrency?: number;
  maxAttempts?: number;
  isPaused?: (runId: string) => boolean;
  isCancelled?: (runId: string) => boolean;
  executeEnabled?: boolean;
  persistFinalizesJob?: boolean;
}

const pausedRuns = new Set<string>();
const cancelledRuns = new Set<string>();

export function backoffMs(failedAttempt: number): number {
  if (failedAttempt <= 1) return 250;
  if (failedAttempt === 2) return 1000;
  return 3000;
}

export function clampConcurrency(n: number | undefined): number {
  return clamp(n ?? DEFAULT_CONCURRENCY, 2, 4);
}

function stamp(now: () => string): string {
  return now();
}

async function defaultJobStore(): Promise<JobStore> {
  const q = await import("../persist/queue.ts");
  return {
    get: (id) => q.getResearchJob(id),
    update: (id, patch) => q.updateResearchJob(id, patch),
    list: (runId) => q.listJobsForRun(runId),
  };
}

export async function startFull100Research(opts?: {
  companies?: Company[];
  snapshots?: Snapshot[];
  deps?: RunnerDeps;
  executeEnabled?: boolean;
  remaining?: Array<{ ticker: string; companyId: string }>;
}): Promise<{ ok: true; runId: string; totalJobs: number } | { ok: false; error: string }> {
  if (!(opts?.executeEnabled ?? opts?.deps?.executeEnabled ?? EXECUTE_FULL_100)) {
    return { ok: false, error: FULL100_EXECUTION_DISABLED };
  }
  const companies = opts?.companies ?? [];
  const snapshots = opts?.snapshots ?? [];
  const q = await import("../persist/queue.ts");
  const conflict = await q.activeFull100Run();
  if (conflict) {
    return { ok: false, error: "ACTIVE_FULL100_RUN" };
  }
  const run = await createFull100Run({
    companies,
    snapshots,
    remaining: opts?.remaining,
  });
  await q.updateResearchRun(run.id, { status: "RUNNING", startedAt: new Date().toISOString() });
  return { ok: true, runId: run.id, totalJobs: run.totalJobs };
}

export async function createFull100Run(input: {
  companies: Company[];
  snapshots: Snapshot[];
  universeId?: string;
  remaining?: Array<{ ticker: string; companyId: string }>;
}): Promise<ResearchRunRow> {
  const remaining = input.remaining ?? remainingUniverseJobs(input.companies, input.snapshots);
  const now = new Date().toISOString();
  const q = await import("../persist/queue.ts");
  const run: ResearchRunRow = {
    id: uid("run"),
    universeId: input.universeId ?? SAMPLE_RESEARCH_100_UNIVERSE_ID,
    type: "INITIAL_BATCH",
    status: "QUEUED",
    totalJobs: remaining.length,
    completedJobs: 0,
    failedJobs: 0,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    modelVersions: { xbagger: "XBG-v2.0", oversold: "OSM-v2.1", quality: "MFC70-v1.2" },
    payload: {
      remaining: remaining.length,
      skippedExisting: SAMPLE_RESEARCH_100_COUNT - remaining.length,
    },
  };
  await q.insertResearchRun(run);
  for (const j of remaining) {
    await q.insertResearchJob({
      id: uid("job"),
      universeId: run.universeId,
      companyId: j.companyId,
      ticker: j.ticker,
      runId: run.id,
      status: "QUEUED",
      attemptCount: 0,
      failureClass: null,
      provider: null,
      lastError: null,
      createdAt: now,
      queuedAt: now,
      startedAt: null,
      completedAt: null,
      updatedAt: now,
      payload: { attempts: [] },
    });
  }
  return run;
}

const SAMPLE_RESEARCH_100_COUNT = 100;

export async function pauseResearchRun(runId: string): Promise<void> {
  pausedRuns.add(runId);
  const q = await import("../persist/queue.ts");
  const run = await q.getResearchRun(runId).catch(() => null);
  if (run) await q.updateResearchRun(runId, { status: "PAUSED" });
}

export async function resumeResearchRun(runId: string, deps?: RunnerDeps): Promise<void> {
  pausedRuns.delete(runId);
  cancelledRuns.delete(runId);
  const q = await import("../persist/queue.ts");
  const run = await q.getResearchRun(runId).catch(() => null);
  if (run) {
    await q.recoverStaleJobs(runId);
    await q.updateResearchRun(runId, { status: "RUNNING" });
  }
  void deps;
}

export async function cancelResearchRun(runId: string, store?: JobStore): Promise<void> {
  cancelledRuns.add(runId);
  pausedRuns.delete(runId);
  const jobs = store ?? (await defaultJobStore());
  const q = await import("../persist/queue.ts").catch(() => null);
  if (q) {
    const run = await q.getResearchRun(runId).catch(() => null);
    if (run) await q.updateResearchRun(runId, { status: "CANCELLED", completedAt: new Date().toISOString() });
  }
  const list = await jobs.list(runId);
  for (const job of list) {
    if (job.status === "QUEUED" || job.status === "RETRY_WAIT" || job.status === "NOT_RESEARCHED") {
      await jobs.update(job.id, { status: "CANCELLED", completedAt: new Date().toISOString() });
    }
  }
}

export async function processJobWithRetry(job: ResearchJobRow, deps: RunnerDeps): Promise<ResearchJobRow> {
  const jobs = deps.jobs ?? (await defaultJobStore());
  const max = deps.maxAttempts ?? MAX_JOB_ATTEMPTS;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => new Date().toISOString());
  let result: Extract<ResearchOutcome, { ok: true }> | null = null;
  const attempts: Array<Record<string, unknown>> = Array.isArray(job.payload.attempts)
    ? [...(job.payload.attempts as Array<Record<string, unknown>>)]
    : [];

  for (let attempt = 1; attempt <= max; attempt++) {
    if (deps.isCancelled?.(job.runId ?? "") || cancelledRuns.has(job.runId ?? "")) {
      await jobs.update(job.id, { status: "CANCELLED", attemptCount: attempt, completedAt: stamp(now) });
      return (await jobs.get(job.id)) ?? job;
    }
    await jobs.update(job.id, {
      status: "RESEARCHING",
      attemptCount: attempt,
      startedAt: stamp(now),
    });
    const requestedAt = stamp(now);
    if (!result) {
      try {
        const outcome = await deps.research(job.ticker);
        if (!outcome.ok) {
          attempts.push({
            provider: "research",
            attempt,
            requestedAt,
            completedAt: stamp(now),
            status: "error",
            errorType: outcome.failureClass,
          });
          await jobs.update(job.id, { payload: { ...job.payload, attempts }, lastError: outcome.error });
          if (!isRetryableFailure(outcome.failureClass) || attempt === max) {
            await jobs.update(job.id, {
              status: "FAILED",
              failureClass: outcome.failureClass,
              lastError: outcome.error,
              attemptCount: attempt,
              completedAt: stamp(now),
              payload: { ...job.payload, attempts },
            });
            return (await jobs.get(job.id)) ?? job;
          }
          await sleep(backoffMs(attempt));
          continue;
        }
        result = outcome;
        attempts.push({
          provider: outcome.provider ?? "research",
          attempt,
          requestedAt,
          completedAt: stamp(now),
          status: "ok",
          errorType: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const cls = classifyQuoteFailure(message);
        attempts.push({
          provider: "research",
          attempt,
          requestedAt,
          completedAt: stamp(now),
          status: "error",
          errorType: cls,
        });
        if (!isRetryableFailure(cls) || attempt === max) {
          await jobs.update(job.id, {
            status: "FAILED",
            failureClass: cls,
            lastError: message,
            attemptCount: attempt,
            completedAt: stamp(now),
            payload: { ...job.payload, attempts },
          });
          return (await jobs.get(job.id)) ?? job;
        }
        await jobs.update(job.id, { payload: { ...job.payload, attempts }, lastError: message });
        await sleep(backoffMs(attempt));
        continue;
      }
    }

    const status = researchStatusOf(result.snapshot);
    try {
      const jobForPersist: ResearchJobRow = {
        ...job,
        attemptCount: attempt,
        payload: { ...job.payload, attempts, snapshotId: result.snapshot.id },
      };
      await deps.persist(result.company, result.snapshot, jobForPersist, status);
      if (!deps.persistFinalizesJob) {
        await jobs.update(job.id, {
          status,
          failureClass: null,
          lastError: null,
          provider: result.provider ?? "research",
          attemptCount: attempt,
          completedAt: stamp(now),
          payload: { ...job.payload, attempts, snapshotId: result.snapshot.id },
        });
      }
      return (await jobs.get(job.id)) ?? { ...job, status, attemptCount: attempt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({
        provider: "database",
        attempt,
        requestedAt: stamp(now),
        completedAt: stamp(now),
        status: "error",
        errorType: "DATABASE_FAILURE",
      });
      if (attempt === max) {
        await jobs.update(job.id, {
          status: "FAILED",
          failureClass: "DATABASE_FAILURE",
          lastError: message,
          attemptCount: attempt,
          completedAt: stamp(now),
          payload: { ...job.payload, attempts },
        });
        return (await jobs.get(job.id)) ?? job;
      }
      await jobs.update(job.id, {
        lastError: message,
        failureClass: "DATABASE_FAILURE",
        payload: { ...job.payload, attempts },
      });
      await sleep(backoffMs(attempt));
    }
  }
  await jobs.update(job.id, { status: "FAILED", failureClass: "UNKNOWN", completedAt: stamp(now) });
  return (await jobs.get(job.id)) ?? job;
}

export async function processRun(
  runId: string,
  deps: RunnerDeps,
  opts?: { maxJobs?: number },
): Promise<{ processed: string[] }> {
  const jobs = deps.jobs ?? (await defaultJobStore());
  if (deps.isPaused?.(runId) || pausedRuns.has(runId) || deps.isCancelled?.(runId) || cancelledRuns.has(runId)) {
    return { processed: [] };
  }
  const list = await jobs.list(runId);
  const pending = list.filter((j) => j.status === "QUEUED" || j.status === "RETRY_WAIT");
  const limited = opts?.maxJobs != null ? pending.slice(0, Math.max(0, opts.maxJobs)) : pending;
  const concurrency = clampConcurrency(deps.concurrency);
  const processed: string[] = [];
  let cursor = 0;
  const stop = () =>
    Boolean(deps.isPaused?.(runId) || deps.isCancelled?.(runId) || pausedRuns.has(runId) || cancelledRuns.has(runId));

  const workers = Array.from({ length: Math.min(concurrency, Math.max(limited.length, 1)) }, async () => {
    while (cursor < limited.length && !stop()) {
      const idx = cursor;
      cursor += 1;
      const job = limited[idx];
      if (!job) break;
      const done = await processJobWithRetry(job, { ...deps, jobs });
      processed.push(done.ticker);
    }
  });
  if (limited.length > 0) await Promise.all(workers);
  return { processed };
}

export function __resetRunnerControl(): void {
  pausedRuns.clear();
  cancelledRuns.clear();
}
