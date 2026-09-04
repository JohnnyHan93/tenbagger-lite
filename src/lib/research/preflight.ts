import { SAMPLE_RESEARCH_100, sampleResearch100Stats } from "../sample-research-100.ts";
import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import type { Sql } from "../db.ts";
import {
  EXECUTE_FULL_100,
  buildUniverseJobs,
  countFakeDemo,
  type PreflightResult,
} from "./jobs.ts";
import { LAST_VERIFIED_BUILD } from "./verified-build.ts";
import type { QuoteProviderHealth } from "./provider-health.ts";
import { productionCapabilities } from "./production.ts";

export type CheckKind = "LIVE" | "LAST_VERIFIED";

export interface PreflightCheck {
  id: string;
  label: string;
  kind: CheckKind;
  pass: boolean;
  detail: string;
}

export interface LivePreflightResult extends PreflightResult {
  checks: PreflightCheck[];
  us50: boolean;
  kr50: boolean;
  noActiveConflict: boolean;
  providerConfig: boolean;
  executorReady: boolean;
  providerUs: boolean;
  providerKr: boolean;
}

export interface LivePreflightInput {
  companies: Company[];
  snapshots: Snapshot[];
  sql?: Sql | null;
  universeMembers?: Array<{ ticker: string; country: string }>;
  executeFull100?: boolean;
  providerProbe?: () => Promise<QuoteProviderHealth>;
}

function check(
  id: string,
  label: string,
  kind: CheckKind,
  pass: boolean,
  detail: string,
): PreflightCheck {
  return { id, label, kind, pass, detail };
}

export async function runLivePreflight(input: LivePreflightInput): Promise<LivePreflightResult> {
  const universe = input.universeMembers ?? SAMPLE_RESEARCH_100;
  const stats = sampleResearch100Stats(universe as Company[]);
  const jobs = buildUniverseJobs(input.companies, input.snapshots);
  const researchedUniverse = jobs.filter((j) => j.status !== "NOT_RESEARCHED").length;
  const remaining = jobs.filter((j) => j.status === "NOT_RESEARCHED").length;
  const universeTickers = new Set(SAMPLE_RESEARCH_100.map((c) => c.ticker.toUpperCase()));
  const extraResearched = input.companies.filter((c) => {
    if (universeTickers.has(c.ticker.toUpperCase())) return false;
    return input.snapshots.some((s) => s.companyId === c.id);
  }).length;
  const fake = countFakeDemo(input.companies);
  const universe100 = stats.total === 100;
  const us50 = stats.us === 50;
  const kr50 = stats.kr === 50;
  const fakeDemoZero = fake === 0;
  const existingPreserved = researchedUniverse >= 3;
  const smoke12Retained = extraResearched + researchedUniverse >= 12;
  const executeFull100 = input.executeFull100 ?? EXECUTE_FULL_100;

  let dbAvailable = false;
  let queuePersistence = false;
  let noActiveConflict = true;
  if (input.sql === null) {
    dbAvailable = false;
    queuePersistence = false;
  } else {
    try {
      const { pingDb, queueTablesReady, activeFull100Run } = await import("../persist/queue.ts");
      const sql = input.sql;
      dbAvailable = await pingDb(sql ?? undefined);
      queuePersistence = dbAvailable ? await queueTablesReady(sql ?? undefined) : false;
      if (queuePersistence) {
        const active = await activeFull100Run(sql ?? undefined);
        noActiveConflict = !active || active.status === "PAUSED";
      }
    } catch {
      dbAvailable = false;
      queuePersistence = false;
    }
  }

  let providerUs = false;
  let providerKr = false;
  let providerProbed = false;
  if (input.providerProbe) {
    try {
      const health = await input.providerProbe();
      providerUs = health.us;
      providerKr = health.kr;
      providerProbed = true;
    } catch {
      providerProbed = true;
      providerUs = false;
      providerKr = false;
    }
  }
  const providerConfig = providerProbed && providerUs && providerKr;
  const caps = productionCapabilities();
  const wired = caps.chunkProcessor && caps.transactionalPersist && caps.productionDeps;
  const executorReady =
    dbAvailable &&
    queuePersistence &&
    universe100 &&
    us50 &&
    kr50 &&
    fakeDemoZero &&
    noActiveConflict &&
    wired;
  const last = LAST_VERIFIED_BUILD;
  const checks: PreflightCheck[] = [
    check("db", "DB 연결", "LIVE", dbAvailable, dbAvailable ? "reachable" : "unreachable"),
    check("universe", "Sample Universe 100", "LIVE", universe100, `total=${stats.total}`),
    check("us50", "US 50", "LIVE", us50, `us=${stats.us}`),
    check("kr50", "KR 50", "LIVE", kr50, `kr=${stats.kr}`),
    check("fake", "Fake demo 0", "LIVE", fakeDemoZero, `fake=${fake}`),
    check("existing", "기존 Sample 리서치 보존", "LIVE", existingPreserved, `universeAnalyzed=${researchedUniverse}`),
    check("smoke", "Smoke 12 보존", "LIVE", smoke12Retained, `extra=${extraResearched} universe=${researchedUniverse}`),
    check("queue", "research_jobs / research_runs", "LIVE", queuePersistence, queuePersistence ? "tables ready" : "missing"),
    check("conflict", "활성 Full-100 충돌 없음", "LIVE", noActiveConflict, noActiveConflict ? "none" : "active run"),
    check("flag", "EXECUTE_FULL_100", "LIVE", executeFull100, executeFull100 ? "YES" : "NO"),
    check(
      "provider",
      "시세/공시 경로",
      "LIVE",
      providerConfig,
      providerProbed ? `US=${providerUs ? "ok" : "fail"} KR=${providerKr ? "ok" : "fail"}; xAI optional` : "not probed",
    ),
    check("executor", "Executor wiring", "LIVE", executorReady, executorReady ? "structural ready" : "not ready"),
    check(
      "typecheck",
      "Typecheck",
      "LAST_VERIFIED",
      last.typecheck === "PASS",
      `${last.commitSha.slice(0, 7)} @ ${last.verifiedAt}`,
    ),
    check(
      "lint",
      "Lint",
      "LAST_VERIFIED",
      last.lint === "PASS",
      `${last.commitSha.slice(0, 7)} @ ${last.verifiedAt}`,
    ),
    check(
      "tests",
      "Tests",
      "LAST_VERIFIED",
      last.tests === "PASS",
      `${last.commitSha.slice(0, 7)} @ ${last.verifiedAt}`,
    ),
    check(
      "build",
      "Production Build",
      "LAST_VERIFIED",
      last.productionBuild === "PASS",
      `${last.commitSha.slice(0, 7)} @ ${last.verifiedAt}`,
    ),
  ];

  const ready = executorReady && executeFull100 && providerConfig;

  const notes: string[] = [];
  if (!executeFull100) notes.push("EXECUTE_FULL_100 = NO — 배치 실행 잠금");
  if (!dbAvailable) notes.push("DB LIVE FAIL");
  if (!universe100) notes.push(`Universe total ${stats.total} ≠ 100`);
  if (!queuePersistence) notes.push("Queue tables LIVE FAIL");
  if (!executorReady) notes.push("Executor not ready");
  notes.push(`LAST VERIFIED build ${last.commitSha.slice(0, 7)}`);

  return {
    p0Tests: last.tests === "PASS",
    productionBuild: last.productionBuild === "PASS",
    dbAvailable,
    universe100,
    smoke12Retained,
    fakeDemoZero,
    queuePersistence,
    existingPreserved,
    executeFull100,
    ready,
    remaining,
    researchedUniverse,
    extraResearched,
    notes,
    p0TestsKind: "LAST_VERIFIED",
    productionBuildKind: "LAST_VERIFIED",
    dbAvailableKind: "LIVE",
    queuePersistenceKind: "LIVE",
    verifiedCommitSha: last.commitSha,
    verifiedAt: last.verifiedAt,
    checks,
    us50,
    kr50,
    noActiveConflict,
    providerConfig,
    executorReady,
    providerUs,
    providerKr,
  };
}
