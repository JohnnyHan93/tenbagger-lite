import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getSql } from "../db.ts";
import { loadWorkspace, persistWorkspace, type WorkspaceDump } from "./repo.ts";
import {
  insertResearchJob,
  insertResearchRun,
  listJobsForRun,
  listResearchRuns,
  type ResearchJobRow,
  type ResearchRunRow,
} from "./queue.ts";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import { tickersEqual } from "../format.ts";
import { countFakeDemo } from "../research/jobs.ts";

export const CHECKPOINT_PATH =
  process.env.IDT_CHECKPOINT_PATH?.trim() || "/workspace/data/idt-full100-checkpoint.json";

export interface Full100Dump {
  dumpedAt: string;
  hasXai: boolean;
  counts: {
    companies: number;
    analyses: number;
    evidences: number;
    runs: number;
    jobs: number;
  };
  universe: {
    sample100: number;
    us: number;
    kr: number;
    analyzed: number;
    remaining: number;
    fakeDemo: number;
    extraSmoke: number;
  };
  preserved: Record<string, boolean>;
  jobs: Array<{
    ticker: string;
    status: string;
    attemptCount: number;
    failureClass: string | null;
    lastError: string | null;
    provider: string | null;
  }>;
  jobCounts: Record<string, number>;
  run: {
    id: string;
    status: string;
    type: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  integrity: {
    orphanAnalyses: number;
    orphanEvidence: number;
    duplicateLatestPerCompany: number;
    successfulJobsWithoutAnalysis: number;
    analysisWithoutCompany: number;
    duplicateActiveFull100: number;
  };
  workspace?: WorkspaceDump;
  runs?: ResearchRunRow[];
  jobRows?: ResearchJobRow[];
}

function latestSnap(workspace: WorkspaceDump, companyId: string) {
  return workspace.snapshots
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function collectFull100Dump(includeWorkspace = false): Promise<Full100Dump> {
  const sql = await getSql();
  const workspace = await loadWorkspace();
  const companiesN = Number((await sql.query<{ n: number }>("select count(*)::int as n from companies"))[0]?.n ?? 0);
  const analysesN = Number((await sql.query<{ n: number }>("select count(*)::int as n from analyses"))[0]?.n ?? 0);
  const evidencesN = Number((await sql.query<{ n: number }>("select count(*)::int as n from evidences"))[0]?.n ?? 0);
  const runsN = Number((await sql.query<{ n: number }>("select count(*)::int as n from research_runs"))[0]?.n ?? 0);
  const jobsN = Number((await sql.query<{ n: number }>("select count(*)::int as n from research_jobs"))[0]?.n ?? 0);

  const us = SAMPLE_RESEARCH_100.filter((c) => c.country !== "KR").length;
  const kr = SAMPLE_RESEARCH_100.filter((c) => c.country === "KR").length;
  const sampleTickers = new Set(SAMPLE_RESEARCH_100.map((c) => c.ticker.toUpperCase()));
  let analyzed = 0;
  const preserved: Record<string, boolean> = { INOD: false, "005930.KS": false, "105560.KS": false };
  for (const ident of SAMPLE_RESEARCH_100) {
    const company = workspace.companies.find((c) => tickersEqual(c.ticker, ident.ticker));
    const snap = company ? latestSnap(workspace, company.id) : undefined;
    if (snap) analyzed += 1;
    if (ident.ticker in preserved) preserved[ident.ticker] = Boolean(snap);
  }
  const extraSmoke = workspace.companies.filter((c) => {
    if (sampleTickers.has(c.ticker.toUpperCase())) return false;
    return workspace.snapshots.some((s) => s.companyId === c.id);
  }).length;

  const runs = await listResearchRuns();
  const active = runs.filter(
    (r) => r.type === "INITIAL_BATCH" && (r.status === "RUNNING" || r.status === "QUEUED" || r.status === "PAUSED"),
  );
  const run = active[0] ?? runs.find((r) => r.type === "INITIAL_BATCH") ?? null;
  const jobRows = run ? await listJobsForRun(run.id) : [];
  const jobCounts: Record<string, number> = {};
  for (const j of jobRows) jobCounts[j.status] = (jobCounts[j.status] ?? 0) + 1;

  const companyIds = new Set(workspace.companies.map((c) => c.id));
  const orphanAnalyses = workspace.snapshots.filter((s) => !companyIds.has(s.companyId)).length;
  const evidenceOrphans = Number(
    (await sql.query<{ n: number }>(
      "select count(*)::int as n from evidences e where e.analysis_id is not null and not exists (select 1 from analyses a where a.id = e.analysis_id)",
    ))[0]?.n ?? 0,
  );
  const duplicateLatestPerCompany = workspace.companies.filter((c) => {
    const snaps = workspace.snapshots.filter((s) => s.companyId === c.id);
    if (snaps.length < 2) return false;
    return new Set(snaps.map((s) => s.createdAt)).size < snaps.length;
  }).length;

  let successfulJobsWithoutAnalysis = 0;
  for (const j of jobRows) {
    if (j.status !== "COMPLETE" && j.status !== "PARTIAL" && j.status !== "RESEARCH_REQUIRED") continue;
    const company = workspace.companies.find((c) => tickersEqual(c.ticker, j.ticker) || c.id === j.companyId);
    const snap = company ? latestSnap(workspace, company.id) : undefined;
    if (!snap) successfulJobsWithoutAnalysis += 1;
  }

  const dump: Full100Dump = {
    dumpedAt: new Date().toISOString(),
    hasXai: Boolean(process.env.XAI_API_KEY),
    counts: {
      companies: companiesN,
      analyses: analysesN,
      evidences: evidencesN,
      runs: runsN,
      jobs: jobsN,
    },
    universe: {
      sample100: SAMPLE_RESEARCH_100.length,
      us,
      kr,
      analyzed,
      remaining: SAMPLE_RESEARCH_100.length - analyzed,
      fakeDemo: countFakeDemo(workspace.companies),
      extraSmoke,
    },
    preserved,
    jobs: jobRows.map((j) => ({
      ticker: j.ticker,
      status: j.status,
      attemptCount: j.attemptCount,
      failureClass: j.failureClass,
      lastError: j.lastError,
      provider: j.provider,
    })),
    jobCounts,
    run: run
      ? {
          id: run.id,
          status: run.status,
          type: run.type,
          totalJobs: run.totalJobs,
          completedJobs: run.completedJobs,
          failedJobs: run.failedJobs,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
        }
      : null,
    integrity: {
      orphanAnalyses,
      orphanEvidence: evidenceOrphans,
      duplicateLatestPerCompany,
      successfulJobsWithoutAnalysis,
      analysisWithoutCompany: orphanAnalyses,
      duplicateActiveFull100: Math.max(0, active.length - (active.length ? 1 : 0)),
    },
  };
  if (includeWorkspace) {
    dump.workspace = workspace;
    dump.runs = runs;
    dump.jobRows = jobRows;
  }
  return dump;
}

export async function writeCheckpoint(): Promise<string> {
  const dump = await collectFull100Dump(true);
  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
  await writeFile(CHECKPOINT_PATH, JSON.stringify(dump), "utf8");
  return CHECKPOINT_PATH;
}

export async function restoreCheckpointIfEmpty(): Promise<boolean> {
  if (process.env.NODE_TEST_CONTEXT) return false;
  if (!process.env.IDT_PGLITE_DIR?.trim()) return false;
  try {
    const sql = await getSql();
    const analyses = Number((await sql.query<{ n: number }>("select count(*)::int as n from analyses"))[0]?.n ?? 0);
    if (analyses > 0) return false;
    const raw = await readFile(CHECKPOINT_PATH, "utf8");
    const dump = JSON.parse(raw) as Full100Dump;
    if (!dump.workspace || dump.workspace.snapshots.length === 0) return false;
    await persistWorkspace(dump.workspace);
    for (const run of dump.runs ?? []) {
      try {
        await insertResearchRun(run);
      } catch {
        /* already present */
      }
    }
    for (const job of dump.jobRows ?? []) {
      try {
        await insertResearchJob(job);
      } catch {
        /* already present */
      }
    }
    console.log(`[checkpoint] restored ${dump.workspace.snapshots.length} analyses from ${CHECKPOINT_PATH}`);
    return true;
  } catch {
    return false;
  }
}
