import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { researchStatusOf } from "./coverage-report.ts";
import { LAST_VERIFIED_BUILD } from "./verified-build.ts";

function latestOf(snapshots: Snapshot[], companyId: string): Snapshot | undefined {
  return snapshots
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export const EXECUTE_FULL_100 = false;
export const FULL100_EXECUTION_DISABLED = "FULL100_EXECUTION_DISABLED";
export const PREFLIGHT_FAILED = "PREFLIGHT_FAILED";
export const MAX_JOB_ATTEMPTS = 3;
export const DEFAULT_CONCURRENCY = 3;

export type JobStatus =
  | "NOT_RESEARCHED"
  | "QUEUED"
  | "RESEARCHING"
  | "COMPLETE"
  | "PARTIAL"
  | "RESEARCH_REQUIRED"
  | "FAILED";

export type FailureClass =
  | "IDENTITY_FAILURE"
  | "QUOTE_PROVIDER_FAILURE"
  | "FINANCIAL_SOURCE_FAILURE"
  | "EVIDENCE_EXTRACTION_FAILURE"
  | "LLM_FAILURE"
  | "DATABASE_FAILURE"
  | "ENGINE_FAILURE"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNKNOWN";

export interface ResearchJob {
  id: string;
  companyId: string;
  ticker: string;
  status: JobStatus;
  failureClass?: FailureClass | null;
  provider?: string | null;
  retryCount: number;
  lastError?: string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
}

export interface PreflightResult {
  p0Tests: boolean;
  productionBuild: boolean;
  dbAvailable: boolean;
  universe100: boolean;
  smoke12Retained: boolean;
  fakeDemoZero: boolean;
  queuePersistence: boolean;
  existingPreserved: boolean;
  executeFull100: boolean;
  ready: boolean;
  remaining: number;
  researchedUniverse: number;
  extraResearched: number;
  notes: string[];
  p0TestsKind: "LAST_VERIFIED";
  productionBuildKind: "LAST_VERIFIED";
  dbAvailableKind: "LIVE";
  queuePersistenceKind: "LIVE";
  verifiedCommitSha: string;
  verifiedAt: string;
}

export function classifyQuoteFailure(message: string): FailureClass {
  const m = message.toLowerCase();
  if (/identity|invalid ticker|unsupported security|conflict/.test(m)) return "IDENTITY_FAILURE";
  if (/timeout|abort/.test(m)) return "TIMEOUT";
  if (/rate|429/.test(m)) return "RATE_LIMITED";
  if (/5\d\d|network|econnreset|fetch failed/.test(m)) return "QUOTE_PROVIDER_FAILURE";
  if (/시가총액|quote/.test(m)) return "QUOTE_PROVIDER_FAILURE";
  if (/llm|grok|xai/.test(m)) return "LLM_FAILURE";
  if (/db|persist|sql|database/.test(m)) return "DATABASE_FAILURE";
  if (/schema|validation/.test(m)) return "ENGINE_FAILURE";
  return "UNKNOWN";
}

export function isRetryableFailure(cls: FailureClass): boolean {
  return (
    cls === "RATE_LIMITED" ||
    cls === "TIMEOUT" ||
    cls === "QUOTE_PROVIDER_FAILURE" ||
    cls === "DATABASE_FAILURE" ||
    cls === "LLM_FAILURE" ||
    cls === "UNKNOWN"
  );
}

export function buildUniverseJobs(companies: Company[], snapshots: Snapshot[]): ResearchJob[] {
  const byTicker = new Map(companies.map((c) => [c.ticker.toUpperCase(), c]));
  return SAMPLE_RESEARCH_100.map((ident) => {
    const company =
      byTicker.get(ident.ticker.toUpperCase()) ??
      companies.find((c) => c.ticker.replace(/\.(KS|KQ)$/i, "") === ident.ticker.replace(/\.(KS|KQ)$/i, ""));
    const snap = company ? latestOf(snapshots, company.id) : null;
    const status: JobStatus = snap ? researchStatusOf(snap) : "NOT_RESEARCHED";
    return {
      id: `job_${ident.ticker}`,
      companyId: company?.id ?? ident.id,
      ticker: ident.ticker,
      status,
      retryCount: 0,
      provider: snap?.researchProvider ?? null,
      completedAt: snap?.createdAt ?? null,
    };
  });
}

export function remainingUniverseJobs(companies: Company[], snapshots: Snapshot[]): ResearchJob[] {
  return buildUniverseJobs(companies, snapshots).filter((j) => j.status === "NOT_RESEARCHED");
}

export function countFakeDemo(companies: Company[]): number {
  return companies.filter((c) =>
    /northline|harbor|redridge|에코반도체장비|한강생활|서해모빌리티/i.test(c.companyName),
  ).length;
}

export function preflight(companies: Company[], snapshots: Snapshot[]): PreflightResult {
  const jobs = buildUniverseJobs(companies, snapshots);
  const researchedUniverse = jobs.filter((j) => j.status !== "NOT_RESEARCHED").length;
  const remaining = jobs.filter((j) => j.status === "NOT_RESEARCHED").length;
  const universeTickers = new Set(SAMPLE_RESEARCH_100.map((c) => c.ticker.toUpperCase()));
  const extraResearched = companies.filter((c) => {
    if (universeTickers.has(c.ticker.toUpperCase())) return false;
    return Boolean(latestOf(snapshots, c.id));
  }).length;
  const fake = countFakeDemo(companies);
  const notes: string[] = [];
  if (remaining > 0) notes.push(`유니버스 미분석 ${remaining}종목. Full 100은 명시 지시 후에만 실행.`);
  if (extraResearched > 0) notes.push(`유니버스 밖 Smoke 분석 ${extraResearched}건은 유지한다.`);
  if (!EXECUTE_FULL_100) notes.push("EXECUTE_FULL_100 = NO");
  notes.push(
    `Typecheck/Lint/Tests/Build = LAST VERIFIED ${LAST_VERIFIED_BUILD.commitSha.slice(0, 7)} @ ${LAST_VERIFIED_BUILD.verifiedAt}`,
  );
  const universe100 = SAMPLE_RESEARCH_100.length === 100;
  const fakeDemoZero = fake === 0;
  const existingPreserved = researchedUniverse >= 3;
  const smoke12Retained = extraResearched + researchedUniverse >= 12;
  return {
    p0Tests: LAST_VERIFIED_BUILD.tests === "PASS",
    productionBuild: LAST_VERIFIED_BUILD.productionBuild === "PASS",
    dbAvailable: false,
    universe100,
    smoke12Retained,
    fakeDemoZero,
    queuePersistence: false,
    existingPreserved,
    executeFull100: EXECUTE_FULL_100,
    ready: false,
    remaining,
    researchedUniverse,
    extraResearched,
    notes,
    p0TestsKind: "LAST_VERIFIED",
    productionBuildKind: "LAST_VERIFIED",
    dbAvailableKind: "LIVE",
    queuePersistenceKind: "LIVE",
    verifiedCommitSha: LAST_VERIFIED_BUILD.commitSha,
    verifiedAt: LAST_VERIFIED_BUILD.verifiedAt,
  };
}
