import { createServerFn } from "@tanstack/react-start";
import type { WorkspaceDump } from "./repo.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import type { Company } from "../types.ts";
import type { AnalysisJobUpdate } from "./repo.ts";

export const loadWorkspaceFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWorkspace } = await import("./repo.ts");
  return loadWorkspace();
});

export const persistWorkspaceFn = createServerFn({ method: "POST" })
  .validator((input: WorkspaceDump) => input)
  .handler(async ({ data }) => {
    const { persistWorkspace } = await import("./repo.ts");
    await persistWorkspace(data);
    return { ok: true as const };
  });

export const saveCompanyFn = createServerFn({ method: "POST" })
  .validator((input: Company) => input)
  .handler(async ({ data }) => {
    const { saveCompany } = await import("./repo.ts");
    await saveCompany(data);
    return { ok: true as const };
  });

export const insertAnalysisFn = createServerFn({ method: "POST" })
  .validator((input: Snapshot) => input)
  .handler(async ({ data }) => {
    const { insertAnalysis } = await import("./repo.ts");
    await insertAnalysis(data);
    return { ok: true as const };
  });

export const saveAnalysisTransactionFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      company: Company;
      snapshot: Snapshot;
      researchRunId?: string;
      job?: AnalysisJobUpdate;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { saveAnalysisTransaction } = await import("./repo.ts");
    await saveAnalysisTransaction(data);
    return { ok: true as const };
  });

export const clearWorkspaceFn = createServerFn({ method: "POST" }).handler(async () => {
  const { clearWorkspace } = await import("./repo.ts");
  await clearWorkspace();
  return { ok: true as const };
});

export const cleanupDemoDataFn = createServerFn({ method: "POST" }).handler(async () => {
  const { cleanupDemoData } = await import("./repo.ts");
  return cleanupDemoData();
});

export const recoverStaleRunsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { recoverAllStaleJobs } = await import("./queue.ts");
  const recovered = await recoverAllStaleJobs();
  return { recovered };
});

export const livePreflightFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWorkspace } = await import("./repo.ts");
  const { runLivePreflight } = await import("../research/preflight.ts");
  const { probeQuoteProviders } = await import("../research/provider-health.ts");
  const ws = await loadWorkspace();
  return runLivePreflight({
    companies: ws.companies,
    snapshots: ws.snapshots,
    providerProbe: probeQuoteProviders,
  });
});

export const queueStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listResearchRuns, listJobsForRun, activeFull100Run, queueTablesReady } = await import("./queue.ts");
  const ready = await queueTablesReady();
  if (!ready) {
    return { ready: false as const, run: null, jobs: [] as QueueJobDto[], runs: [] as QueueRunDto[] };
  }
  const run = await activeFull100Run();
  const jobs = run ? await listJobsForRun(run.id) : [];
  const runs = await listResearchRuns();
  return {
    ready: true as const,
    run: run ? toRunDto(run) : null,
    jobs: jobs.map(toJobDto),
    runs: runs.map(toRunDto),
  };
});

type QueueRunDto = {
  id: string;
  status: string;
  type: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
};

type QueueJobDto = {
  id: string;
  ticker: string;
  status: string;
  attemptCount: number;
  failureClass: string | null;
  lastError: string | null;
};

function toRunDto(run: {
  id: string;
  status: string;
  type: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
}): QueueRunDto {
  return {
    id: run.id,
    status: run.status,
    type: run.type,
    totalJobs: run.totalJobs,
    completedJobs: run.completedJobs,
    failedJobs: run.failedJobs,
  };
}

function toJobDto(job: {
  id: string;
  ticker: string;
  status: string;
  attemptCount: number;
  failureClass: string | null;
  lastError: string | null;
}): QueueJobDto {
  return {
    id: job.id,
    ticker: job.ticker,
    status: job.status,
    attemptCount: job.attemptCount,
    failureClass: job.failureClass,
    lastError: job.lastError,
  };
}

export const startFull100Fn = createServerFn({ method: "POST" }).handler(async () => {
  const { startFull100FromWorkspace } = await import("../research/production.ts");
  return startFull100FromWorkspace();
});

export const processFull100ChunkFn = createServerFn({ method: "POST" })
  .validator((input: { runId: string; useAi?: boolean }) => input)
  .handler(async ({ data }) => {
    const { processFull100Chunk, createProductionDeps } = await import("../research/production.ts");
    const result = await processFull100Chunk(data.runId, {
      deps: data.useAi ? createProductionDeps({ useAi: true }) : undefined,
    });
    return {
      ok: result.ok,
      processed: result.processed,
      skipped: result.skipped ?? null,
      run: result.run
        ? {
            id: result.run.id,
            status: result.run.status,
            totalJobs: result.run.totalJobs,
            completedJobs: result.run.completedJobs,
            failedJobs: result.run.failedJobs,
          }
        : null,
    };
  });

export const pauseFull100Fn = createServerFn({ method: "POST" })
  .validator((input: { runId: string }) => input)
  .handler(async ({ data }) => {
    const { pauseResearchRun } = await import("../research/runner.ts");
    await pauseResearchRun(data.runId);
    return { ok: true as const };
  });

export const resumeFull100Fn = createServerFn({ method: "POST" })
  .validator((input: { runId: string }) => input)
  .handler(async ({ data }) => {
    const { resumeResearchRun } = await import("../research/runner.ts");
    await resumeResearchRun(data.runId);
    return { ok: true as const };
  });

export const cancelFull100Fn = createServerFn({ method: "POST" })
  .validator((input: { runId: string }) => input)
  .handler(async ({ data }) => {
    const { cancelResearchRun } = await import("../research/runner.ts");
    await cancelResearchRun(data.runId);
    return { ok: true as const };
  });

export const full100DumpFn = createServerFn({ method: "GET" }).handler(async () => {
  const { collectFull100Dump } = await import("./checkpoint.ts");
  const dump = await collectFull100Dump(false);
  return {
    dumpedAt: dump.dumpedAt,
    hasXai: dump.hasXai,
    counts: dump.counts,
    universe: dump.universe,
    preserved: dump.preserved,
    jobs: dump.jobs,
    jobCounts: dump.jobCounts,
    run: dump.run,
    integrity: dump.integrity,
  };
});

export const full100CheckpointFn = createServerFn({ method: "POST" }).handler(async () => {
  const { writeCheckpoint } = await import("./checkpoint.ts");
  const path = await writeCheckpoint();
  return { ok: true as const, path };
});

export const full100ReportFn = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWorkspace } = await import("./repo.ts");
  const { buildFull100Report } = await import("../research/full100-report.ts");
  const ws = await loadWorkspace();
  return buildFull100Report(ws.companies, ws.snapshots);
});

export const v24StartFn = createServerFn({ method: "POST" }).handler(async () => {
  const { v24Start } = await import("../research/v24-operator.ts");
  return v24Start();
});

export const v24ChunkFn = createServerFn({ method: "POST" })
  .validator((input: { runId: string }) => input)
  .handler(async ({ data }) => {
    const { v24Chunk } = await import("../research/v24-operator.ts");
    const result = await v24Chunk(data.runId);
    return {
      ok: result.ok,
      processed: result.processed,
      skipped: result.skipped ?? null,
      run: result.run
        ? {
            id: result.run.id,
            status: result.run.status,
            totalJobs: result.run.totalJobs,
            completedJobs: result.run.completedJobs,
            failedJobs: result.run.failedJobs,
          }
        : null,
    };
  });

export const v24ResearchOneFn = createServerFn({ method: "POST" })
  .validator((input: { ticker: string }) => input)
  .handler(async ({ data }) => {
    const { v24ResearchOne } = await import("../research/v24-operator.ts");
    return v24ResearchOne(data.ticker);
  });
