import type { Company, ResearchDraft } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { tickersEqual } from "../format.ts";
import { uid } from "../utils.ts";
import {
  EXECUTE_FULL_100,
  FULL100_EXECUTION_DISABLED,
  DEFAULT_CONCURRENCY,
  classifyQuoteFailure,
} from "./jobs.ts";
import {
  processRun,
  startFull100Research,
  type RunnerDeps,
} from "./runner.ts";
import type { ResearchRunRow } from "../persist/queue.ts";
import type { AnalysisJobUpdate, WorkspaceDump } from "../persist/repo.ts";
import type { QuoteProviderHealth } from "./provider-health.ts";

export const DEFAULT_CHUNK_SIZE = DEFAULT_CONCURRENCY;

export interface ProductionOverrides {
  executeResearch?: (input: { ticker: string; useAi: boolean }) => Promise<
    { ok: true; draft: ResearchDraft } | { ok: false; error: string }
  >;
  saveAnalysisTransaction?: (input: {
    company: Company;
    snapshot: Snapshot;
    researchRunId?: string;
    job?: AnalysisJobUpdate;
  }) => Promise<void>;
  runSnapshotFromDraft?: (input: {
    company: Company;
    draft: ResearchDraft;
    researchPriorityOn?: boolean;
  }) => Snapshot;
  loadWorkspace?: () => Promise<WorkspaceDump>;
  useAi?: boolean;
}

export function productionCapabilities(): {
  chunkProcessor: boolean;
  transactionalPersist: boolean;
  productionDeps: boolean;
} {
  return {
    chunkProcessor: typeof processFull100Chunk === "function",
    transactionalPersist: true,
    productionDeps: true,
  };
}

export function createProductionDeps(overrides: ProductionOverrides = {}): RunnerDeps {
  const useAi = overrides.useAi ?? false;
  return {
    persistFinalizesJob: true,
    concurrency: DEFAULT_CHUNK_SIZE,
    research: async (ticker) => {
      const executeResearch =
        overrides.executeResearch ?? (await import("./ticker.ts")).executeResearch;
      const runSnapshotFromDraft =
        overrides.runSnapshotFromDraft ?? (await import("../engines/run.ts")).runSnapshotFromDraft;
      const loadWorkspace = overrides.loadWorkspace ?? (await import("../persist/repo.ts")).loadWorkspace;
      const { lookupIdentity } = await import("./identity.ts");
      const res = await executeResearch({ ticker, useAi });
      if (!res.ok) {
        return { ok: false, failureClass: classifyQuoteFailure(res.error), error: res.error };
      }
      const ws = await loadWorkspace();
      const existing = ws.companies.find(
        (c) => tickersEqual(c.ticker, ticker) || tickersEqual(c.ticker, res.draft.quote.ticker),
      );
      const ident = lookupIdentity(res.draft.quote.ticker) ?? lookupIdentity(ticker);
      const now = new Date().toISOString();
      const q = res.draft.quote;
      const company: Company =
        existing ?? {
          id: uid("c"),
          ticker: q.ticker,
          exchange: ident?.exchange ?? q.exchange,
          companyName: ident?.companyName ?? q.companyName,
          country: ident?.country ?? q.country,
          sector: ident?.sector ?? q.sector,
          industry: ident?.industry ?? q.industry,
          createdAt: now,
          updatedAt: now,
        };
      const snapshot = runSnapshotFromDraft({
        company,
        draft: res.draft,
        researchPriorityOn: true,
      });
      return { ok: true, company, snapshot, provider: res.draft.researchProvider };
    },
    persist: async (company, snapshot, job, status) => {
      const save =
        overrides.saveAnalysisTransaction ??
        (await import("../persist/repo.ts")).saveAnalysisTransaction;
      await save({
        company,
        snapshot,
        researchRunId: job.runId ?? undefined,
        job: {
          id: job.id,
          patch: {
            status,
            failureClass: null,
            lastError: null,
            provider: snapshot.researchProvider,
            completedAt: new Date().toISOString(),
            payload: { ...job.payload, snapshotId: snapshot.id },
          },
        },
      });
    },
  };
}

export async function startFull100FromWorkspace(opts?: {
  executeEnabled?: boolean;
  loadWorkspace?: () => Promise<WorkspaceDump>;
  providerProbe?: () => Promise<QuoteProviderHealth>;
  remaining?: Array<{ ticker: string; companyId: string }>;
}): Promise<{ ok: true; runId: string; totalJobs: number } | { ok: false; error: string }> {
  if (!(opts?.executeEnabled ?? EXECUTE_FULL_100)) {
    return { ok: false, error: FULL100_EXECUTION_DISABLED };
  }
  const loadWorkspace = opts?.loadWorkspace ?? (await import("../persist/repo.ts")).loadWorkspace;
  const ws = await loadWorkspace();
  const { runLivePreflight } = await import("./preflight.ts");
  await runLivePreflight({
    companies: ws.companies,
    snapshots: ws.snapshots,
    providerProbe: opts?.providerProbe,
  });
  return startFull100Research({
    companies: ws.companies,
    snapshots: ws.snapshots,
    executeEnabled: true,
    remaining: opts?.remaining,
  });
}

export async function processFull100Chunk(
  runId: string,
  opts?: {
    executeEnabled?: boolean;
    deps?: RunnerDeps;
    chunkSize?: number;
  },
): Promise<{
  ok: boolean;
  processed: string[];
  run: ResearchRunRow | null;
  skipped?: string;
}> {
  if (!(opts?.executeEnabled ?? EXECUTE_FULL_100)) {
    return { ok: false, processed: [], run: null, skipped: FULL100_EXECUTION_DISABLED };
  }
  const q = await import("../persist/queue.ts");
  const run = await q.getResearchRun(runId);
  if (!run) return { ok: false, processed: [], run: null, skipped: "RUN_NOT_FOUND" };
  if (run.status === "PAUSED" || run.status === "CANCELLED" || run.status === "COMPLETE" || run.status === "FAILED") {
    return { ok: true, processed: [], run, skipped: run.status };
  }
  await q.recoverStaleJobs(runId);
  const chunkSize = opts?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const deps = opts?.deps ?? createProductionDeps();
  const result = await processRun(runId, { ...deps, concurrency: chunkSize }, { maxJobs: chunkSize });
  const synced = await q.syncRunProgress(runId);
  return { ok: true, processed: result.processed, run: synced };
}
