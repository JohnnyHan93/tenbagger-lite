import { getSql, type Sql } from "../db.ts";
import {
  isAutoSeededHeuristicSnapshot,
  isFakeDemoCompany,
  isFakeDemoSnapshot,
  isFakeDemoUniverse,
  type DemoCompanyLike,
  type DemoSnapshotLike,
  type DemoUniverseLike,
} from "../demo.ts";
import type { Snapshot, Universe, AuditLog, AppSettings } from "../domain/snapshot.ts";
import type { Company, FinancialSnapshot } from "../types.ts";
import type { ResearchJobRow } from "./queue.ts";

export interface WorkspaceDump {
  companies: Company[];
  snapshots: Snapshot[];
  universes: Universe[];
  watchlist: string[];
  audit: AuditLog[];
  settings: AppSettings | null;
}

function asJson(v: unknown): string {
  return JSON.stringify(v);
}

function parse<T>(row: T | string): T {
  return typeof row === "string" ? (JSON.parse(row) as T) : row;
}

function normalizeFinancials(f: FinancialSnapshot | undefined | null): FinancialSnapshot {
  return {
    revenueTtm: f?.revenueTtm ?? null,
    revenuePrior: f?.revenuePrior ?? null,
    operatingIncomeTtm: f?.operatingIncomeTtm ?? null,
    netIncomeTtm: f?.netIncomeTtm ?? null,
    cash: f?.cash ?? null,
    totalDebt: f?.totalDebt ?? null,
    sharesOutstanding: f?.sharesOutstanding ?? null,
    grossMargin: f?.grossMargin ?? null,
    operatingMargin: f?.operatingMargin ?? null,
    cfo: f?.cfo ?? null,
    fcf: f?.fcf ?? null,
    fcfSource: f?.fcfSource ?? null,
  };
}

function normalizeSnapshot(s: Snapshot): Snapshot {
  return { ...s, financials: normalizeFinancials(s.financials) };
}

export async function loadWorkspace(): Promise<WorkspaceDump> {
  const sql = await getSql();
  const companies = await sql.query<{ payload: Company | string }>("select payload from companies order by ticker");
  const analyses = await sql.query<{ payload: Snapshot | string }>(
    "select payload from analyses order by as_of, created_at",
  );
  const universes = await sql.query<{ payload: Universe | string }>("select payload from universes order by created_at");
  const watch = await sql.query<{ company_id: string }>("select company_id from watchlist");
  const logs = await sql.query<{ payload: AuditLog | string }>(
    "select payload from analysis_change_logs order by timestamp",
  );
  const kv = await sql.query<{ value: AppSettings | string }>("select value from app_kv where key = $1", ["settings"]);

  return {
    companies: companies.map((r) => parse(r.payload)),
    snapshots: analyses.map((r) => normalizeSnapshot(parse(r.payload))),
    universes: universes.map((r) => parse(r.payload)),
    watchlist: watch.map((r) => r.company_id),
    audit: logs.map((r) => parse(r.payload)),
    settings: kv[0] ? parse(kv[0].value) : null,
  };
}

export async function saveCompany(company: Company, sql?: Sql): Promise<void> {
  const db = sql ?? (await getSql());
  await db.query(
    `insert into companies (id, ticker, exchange, company_name, country, sector, industry, cohort, sample, created_at, updated_at, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
     on conflict (id) do update set
       ticker = excluded.ticker,
       exchange = excluded.exchange,
       company_name = excluded.company_name,
       country = excluded.country,
       sector = excluded.sector,
       industry = excluded.industry,
       cohort = excluded.cohort,
       sample = excluded.sample,
       updated_at = excluded.updated_at,
       payload = excluded.payload`,
    [
      company.id,
      company.ticker,
      company.exchange,
      company.companyName,
      company.country,
      company.sector,
      company.industry,
      company.cohort ?? null,
      Boolean(company.sample),
      company.createdAt,
      company.updatedAt,
      asJson(company),
    ],
  );
}

async function insertEvidenceRows(tx: Sql, snap: Snapshot): Promise<void> {
  for (const ev of snap.evidence ?? []) {
    await tx.query(
      `insert into evidences (id, company_id, analysis_id, ticker, title, statement, evidence_type, source_tier, source_name, source_url, published_at, retrieved_at, as_of_date, confidence, factor_targets, engine_targets, status, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18::jsonb)
       on conflict (id) do nothing`,
      [
        ev.id,
        snap.companyId,
        snap.id,
        ev.ticker ?? null,
        ev.title ?? ev.factorCode,
        ev.statement ?? ev.evidence,
        ev.evidenceType,
        ev.sourceTier ?? "TIER_3",
        ev.sourceName,
        ev.sourceUrl,
        ev.publishedAt ?? ev.sourceDate,
        ev.retrievedAt ?? ev.createdAt,
        ev.asOfDate ?? snap.asOf,
        ev.confidence,
        asJson(ev.factorTargets ?? [ev.factorCode]),
        asJson(ev.engineTargets ?? ["xbagger"]),
        ev.status ?? "ACTIVE",
        asJson(ev),
      ],
    );
  }
}

export async function insertAnalysis(snap: Snapshot, researchRunId?: string, sql?: Sql): Promise<void> {
  const run = async (tx: Sql) => {
    const versions = {
      xbagger: snap.xbagger.version,
      oversold: snap.oversold.version,
      quality: snap.quality.version,
    };
    await tx.query(
      `insert into analyses (id, company_id, as_of, created_at, research_run_id, model_versions, payload)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
       on conflict (id) do nothing`,
      [snap.id, snap.companyId, snap.asOf, snap.createdAt, researchRunId ?? null, asJson(versions), asJson(snap)],
    );
    await insertEvidenceRows(tx, snap);
  };
  if (sql) {
    await run(sql);
    return;
  }
  const db = await getSql();
  await db.transaction(run);
}

export interface AnalysisJobUpdate {
  id: string;
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
  >;
}

export async function saveAnalysisTransaction(input: {
  company: Company;
  snapshot: Snapshot;
  researchRunId?: string;
  job?: AnalysisJobUpdate;
  sql?: Sql;
}): Promise<void> {
  const db = input.sql ?? (await getSql());
  await db.transaction(async (tx) => {
    await saveCompany(input.company, tx);
    await insertAnalysis(input.snapshot, input.researchRunId, tx);
    if (input.job) {
      const { updateResearchJob } = await import("./queue.ts");
      await updateResearchJob(input.job.id, input.job.patch, tx);
    }
  });
}

export async function saveUniverse(u: Universe): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into universes (id, name, version, market, status, created_at, locked_at, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     on conflict (id) do update set
       name = excluded.name,
       version = excluded.version,
       market = excluded.market,
       status = excluded.status,
       locked_at = excluded.locked_at,
       payload = excluded.payload`,
    [u.id, u.name, u.version, u.market, u.status, u.createdAt, u.lockedAt, asJson(u)],
  );
  await sql.query("delete from universe_members where universe_id = $1", [u.id]);
  for (const t of u.tickers) {
    await sql.query(
      "insert into universe_members (universe_id, ticker, name) values ($1,$2,$3) on conflict do nothing",
      [u.id, t.ticker, t.name ?? null],
    );
  }
}

export async function saveWatchlist(ids: string[]): Promise<void> {
  const sql = await getSql();
  await sql.query("delete from watchlist");
  for (const id of ids) {
    await sql.query("insert into watchlist (company_id) values ($1) on conflict do nothing", [id]);
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into app_kv (key, value) values ('settings', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [asJson(settings)],
  );
}

export async function insertAudit(log: AuditLog): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into analysis_change_logs (id, engine, model_version, factor_id, snapshot_id, old_value, new_value, reason, user_override, timestamp, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     on conflict (id) do nothing`,
    [
      log.id,
      log.engine,
      log.modelVersion,
      log.factorId,
      log.snapshotId,
      log.oldValue,
      log.newValue,
      log.reason,
      log.userOverride,
      log.timestamp,
      asJson(log),
    ],
  );
}

export async function persistWorkspace(dump: WorkspaceDump): Promise<void> {
  for (const c of dump.companies) await saveCompany(c);
  for (const s of dump.snapshots) await insertAnalysis(s);
  for (const u of dump.universes) await saveUniverse(u);
  await saveWatchlist(dump.watchlist);
  for (const a of dump.audit) await insertAudit(a);
  if (dump.settings) await saveSettings(dump.settings);
}

export async function clearWorkspace(): Promise<void> {
  const sql = await getSql();
  await sql.query("delete from universe_members");
  await sql.query("delete from universes");
  await sql.query("delete from evidences");
  await sql.query("delete from analyses");
  await sql.query("delete from analysis_change_logs");
  await sql.query("delete from watchlist");
  await sql.query("delete from companies");
  await sql.query("delete from app_kv");
}

export interface DemoCleanupReport {
  companiesRemoved: number;
  analysesRemoved: number;
  evidenceRemoved: number;
  universesRemoved: number;
  watchlistRemoved: number;
  logsRemoved: number;
  realUserRecordsAffected: number;
  status: "PASS" | "EMPTY";
  planned: Array<{ kind: string; id: string; reason: string }>;
}

function parsePayload<T>(row: T | string): T {
  return typeof row === "string" ? (JSON.parse(row) as T) : row;
}

export async function cleanupDemoData(): Promise<DemoCleanupReport> {
  const sql = await getSql();
  const planned: DemoCleanupReport["planned"] = [];

  const companyRows = await sql.query<{
    id: string;
    ticker: string;
    company_name: string;
    sample: boolean;
    payload: Company | string;
  }>("select id, ticker, company_name, sample, payload from companies");
  const companies = companyRows.map((r) => {
    const payload = parsePayload(r.payload);
    const merged: DemoCompanyLike = {
      id: r.id,
      ticker: r.ticker || payload.ticker,
      companyName: r.company_name || payload.companyName,
      sample: Boolean(r.sample || payload.sample),
      cohort: payload.cohort,
      seedTag: payload.seedTag,
    };
    return { id: r.id, merged };
  });
  const fakeCompanyIds: string[] = [];
  for (const c of companies) {
    if (isFakeDemoCompany(c.merged)) {
      fakeCompanyIds.push(c.id);
      planned.push({
        kind: "company",
        id: c.id,
        reason: `FAKE_DEMO ${c.merged.ticker ?? ""} ${c.merged.companyName ?? ""}`.trim(),
      });
    }
  }

  const analysisRows = await sql.query<{ id: string; company_id: string; payload: Snapshot | string }>(
    "select id, company_id, payload from analyses",
  );
  const companyById = new Map(companies.map((c) => [c.id, c.merged]));
  const fakeAnalysisIds: string[] = [];
  const fakeAnalysisSet = new Set<string>();
  for (const row of analysisRows) {
    const snap = parsePayload(row.payload) as DemoSnapshotLike;
    const like: DemoSnapshotLike = {
      id: row.id,
      companyId: row.company_id,
      sample: snap.sample,
      asOf: snap.asOf,
      createdAt: snap.createdAt,
      researchProvider: snap.researchProvider,
    };
    if (
      fakeCompanyIds.includes(row.company_id) ||
      isFakeDemoSnapshot(like, companyById.get(row.company_id)) ||
      isAutoSeededHeuristicSnapshot(like)
    ) {
      if (!fakeAnalysisSet.has(row.id)) {
        fakeAnalysisSet.add(row.id);
        fakeAnalysisIds.push(row.id);
        planned.push({
          kind: "analysis",
          id: row.id,
          reason: like.sample ? "sample snapshot" : (like.researchProvider ?? "seeded heuristic"),
        });
      }
    }
  }

  const universeRows = await sql.query<{ id: string; name: string; payload: Universe | string }>(
    "select id, name, payload from universes",
  );
  const fakeUniverseIds: string[] = [];
  for (const row of universeRows) {
    const u = parsePayload(row.payload);
    const like: DemoUniverseLike = { id: row.id, name: row.name || u.name };
    if (isFakeDemoUniverse(like)) {
      fakeUniverseIds.push(row.id);
      planned.push({ kind: "universe", id: row.id, reason: like.name ?? row.id });
    }
  }

  let evidenceRemoved = 0;
  for (const id of fakeAnalysisIds) {
    const ev = await sql.query<{ id: string }>("select id from evidences where analysis_id = $1", [id]);
    evidenceRemoved += ev.length;
    await sql.query("delete from evidences where analysis_id = $1", [id]);
    await sql.query("delete from analysis_change_logs where snapshot_id = $1", [id]);
    await sql.query("delete from analyses where id = $1", [id]);
  }
  for (const id of fakeCompanyIds) {
    const ev = await sql.query<{ id: string }>("select id from evidences where company_id = $1", [id]);
    evidenceRemoved += ev.length;
    await sql.query("delete from evidences where company_id = $1", [id]);
    await sql.query("delete from analyses where company_id = $1", [id]);
    await sql.query("delete from watchlist where company_id = $1", [id]);
    await sql.query("delete from companies where id = $1", [id]);
  }
  for (const id of fakeUniverseIds) {
    await sql.query("delete from universe_members where universe_id = $1", [id]);
    await sql.query("delete from universes where id = $1", [id]);
  }

  return {
    companiesRemoved: fakeCompanyIds.length,
    analysesRemoved: fakeAnalysisIds.length,
    evidenceRemoved,
    universesRemoved: fakeUniverseIds.length,
    watchlistRemoved: fakeCompanyIds.length,
    logsRemoved: fakeAnalysisIds.length,
    realUserRecordsAffected: 0,
    status: "PASS",
    planned,
  };
}
