import { getSql, type Sql } from "../db.ts";
import type { FailureClass, JobStatus } from "../research/jobs.ts";

export type RunType = "INITIAL_BATCH" | "REFRESH" | "MANUAL";
export type RunStatus = "QUEUED" | "RUNNING" | "PAUSED" | "COMPLETE" | "CANCELLED" | "FAILED";

export interface ResearchRunRow {
  id: string;
  universeId: string | null;
  type: RunType;
  status: RunStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  modelVersions: Record<string, string>;
  payload: Record<string, unknown>;
}

export interface ResearchJobRow {
  id: string;
  universeId: string | null;
  companyId: string | null;
  ticker: string;
  runId: string | null;
  status: JobStatus | "RETRY_WAIT" | "CANCELLED";
  attemptCount: number;
  failureClass: FailureClass | null;
  provider: string | null;
  lastError: string | null;
  createdAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  payload: Record<string, unknown>;
}

function asJson(v: unknown): string {
  return JSON.stringify(v);
}

function parse<T>(row: T | string): T {
  return typeof row === "string" ? (JSON.parse(row) as T) : row;
}

export async function pingDb(sql?: Sql): Promise<boolean> {
  try {
    const db = sql ?? (await getSql());
    const rows = await db.query<{ ok: number }>("select 1 as ok");
    return rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

export async function queueTablesReady(sql?: Sql): Promise<boolean> {
  try {
    const db = sql ?? (await getSql());
    await db.query("select 1 from research_jobs limit 0");
    await db.query("select 1 from research_runs limit 0");
    return true;
  } catch {
    return false;
  }
}

export async function insertResearchRun(run: ResearchRunRow, sql?: Sql): Promise<void> {
  const db = sql ?? (await getSql());
  await db.query(
    `insert into research_runs (id, universe_id, type, status, total_jobs, completed_jobs, failed_jobs, started_at, completed_at, created_at, model_versions, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
    [
      run.id,
      run.universeId,
      run.type,
      run.status,
      run.totalJobs,
      run.completedJobs,
      run.failedJobs,
      run.startedAt,
      run.completedAt,
      run.createdAt,
      asJson(run.modelVersions),
      asJson(run.payload),
    ],
  );
}

export async function updateResearchRun(
  id: string,
  patch: Partial<Pick<ResearchRunRow, "status" | "totalJobs" | "completedJobs" | "failedJobs" | "startedAt" | "completedAt" | "payload">>,
  sql?: Sql,
): Promise<void> {
  const db = sql ?? (await getSql());
  const current = await getResearchRun(id, db);
  if (!current) throw new Error(`research run ${id} not found`);
  const next = { ...current, ...patch };
  await db.query(
    `update research_runs set status=$2, total_jobs=$3, completed_jobs=$4, failed_jobs=$5, started_at=$6, completed_at=$7, payload=$8::jsonb
     where id=$1`,
    [id, next.status, next.totalJobs, next.completedJobs, next.failedJobs, next.startedAt, next.completedAt, asJson(next.payload)],
  );
}

export async function getResearchRun(id: string, sql?: Sql): Promise<ResearchRunRow | null> {
  const db = sql ?? (await getSql());
  const rows = await db.query<{
    id: string;
    universe_id: string | null;
    type: RunType;
    status: RunStatus;
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    model_versions: Record<string, string> | string;
    payload: Record<string, unknown> | string;
  }>("select * from research_runs where id = $1", [id]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    universeId: r.universe_id,
    type: r.type,
    status: r.status,
    totalJobs: Number(r.total_jobs),
    completedJobs: Number(r.completed_jobs),
    failedJobs: Number(r.failed_jobs),
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    modelVersions: parse(r.model_versions),
    payload: parse(r.payload),
  };
}

export async function listResearchRuns(sql?: Sql): Promise<ResearchRunRow[]> {
  const db = sql ?? (await getSql());
  const rows = await db.query<{ id: string }>("select id from research_runs order by created_at desc");
  const out: ResearchRunRow[] = [];
  for (const r of rows) {
    const full = await getResearchRun(r.id, db);
    if (full) out.push(full);
  }
  return out;
}

export async function insertResearchJob(job: ResearchJobRow, sql?: Sql): Promise<void> {
  const db = sql ?? (await getSql());
  await db.query(
    `insert into research_jobs (id, universe_id, company_id, ticker, run_id, status, attempt_count, failure_class, provider, last_error, created_at, queued_at, started_at, completed_at, updated_at, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)`,
    [
      job.id,
      job.universeId,
      job.companyId,
      job.ticker,
      job.runId,
      job.status,
      job.attemptCount,
      job.failureClass,
      job.provider,
      job.lastError,
      job.createdAt,
      job.queuedAt,
      job.startedAt,
      job.completedAt,
      job.updatedAt,
      asJson(job.payload),
    ],
  );
}

export async function updateResearchJob(
  id: string,
  patch: Partial<
    Pick<
      ResearchJobRow,
      "status" | "attemptCount" | "failureClass" | "provider" | "lastError" | "queuedAt" | "startedAt" | "completedAt" | "payload"
    >
  >,
  sql?: Sql,
): Promise<void> {
  const db = sql ?? (await getSql());
  const current = await getResearchJob(id, db);
  if (!current) throw new Error(`research job ${id} not found`);
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await db.query(
    `update research_jobs set status=$2, attempt_count=$3, failure_class=$4, provider=$5, last_error=$6, queued_at=$7, started_at=$8, completed_at=$9, updated_at=$10, payload=$11::jsonb
     where id=$1`,
    [
      id,
      next.status,
      next.attemptCount,
      next.failureClass,
      next.provider,
      next.lastError,
      next.queuedAt,
      next.startedAt,
      next.completedAt,
      next.updatedAt,
      asJson(next.payload),
    ],
  );
}

export async function getResearchJob(id: string, sql?: Sql): Promise<ResearchJobRow | null> {
  const db = sql ?? (await getSql());
  const rows = await db.query<{
    id: string;
    universe_id: string | null;
    company_id: string | null;
    ticker: string;
    run_id: string | null;
    status: ResearchJobRow["status"];
    attempt_count: number;
    failure_class: FailureClass | null;
    provider: string | null;
    last_error: string | null;
    created_at: string;
    queued_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    updated_at: string;
    payload: Record<string, unknown> | string;
  }>("select * from research_jobs where id = $1", [id]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    universeId: r.universe_id,
    companyId: r.company_id,
    ticker: r.ticker,
    runId: r.run_id,
    status: r.status,
    attemptCount: Number(r.attempt_count),
    failureClass: r.failure_class,
    provider: r.provider,
    lastError: r.last_error,
    createdAt: r.created_at,
    queuedAt: r.queued_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
    payload: parse(r.payload),
  };
}

export async function listJobsForRun(runId: string, sql?: Sql): Promise<ResearchJobRow[]> {
  const db = sql ?? (await getSql());
  const rows = await db.query<{ id: string }>(
    "select id from research_jobs where run_id = $1 order by ticker",
    [runId],
  );
  const out: ResearchJobRow[] = [];
  for (const r of rows) {
    const full = await getResearchJob(r.id, db);
    if (full) out.push(full);
  }
  return out;
}

export async function recoverStaleJobs(runId: string, sql?: Sql): Promise<number> {
  const db = sql ?? (await getSql());
  const stale = await db.query<{ id: string }>(
    "select id from research_jobs where run_id = $1 and status = 'RESEARCHING'",
    [runId],
  );
  const now = new Date().toISOString();
  for (const row of stale) {
    await updateResearchJob(row.id, { status: "QUEUED", queuedAt: now, startedAt: null }, db);
  }
  return stale.length;
}

export async function recoverAllStaleJobs(sql?: Sql): Promise<number> {
  const db = sql ?? (await getSql());
  if (!(await queueTablesReady(db))) return 0;
  const runs = await db.query<{ id: string }>(
    "select id from research_runs where status in ('RUNNING','PAUSED')",
  );
  let n = 0;
  for (const row of runs) n += await recoverStaleJobs(row.id, db);
  return n;
}

export const TERMINAL_JOB_STATUSES = new Set([
  "COMPLETE",
  "PARTIAL",
  "RESEARCH_REQUIRED",
  "FAILED",
  "CANCELLED",
]);

export function isTerminalJobStatus(status: ResearchJobRow["status"]): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

export async function activeFull100Run(sql?: Sql): Promise<ResearchRunRow | null> {
  const db = sql ?? (await getSql());
  if (!(await queueTablesReady(db))) return null;
  const rows = await db.query<{ id: string }>(
    "select id from research_runs where status in ('RUNNING','PAUSED','QUEUED') and type = 'INITIAL_BATCH' order by created_at desc limit 1",
  );
  if (!rows[0]) return null;
  return getResearchRun(rows[0].id, db);
}
