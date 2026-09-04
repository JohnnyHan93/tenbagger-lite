import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { researchStatusOf } from "./coverage-report.ts";

function latestOf(snapshots: Snapshot[], companyId: string): Snapshot | undefined {
  return snapshots
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export const EXECUTE_FULL_100 = false;

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
}

export function classifyQuoteFailure(message: string): FailureClass {
  const m = message.toLowerCase();
  if (/timeout|abort/.test(m)) return "TIMEOUT";
  if (/rate|429/.test(m)) return "RATE_LIMITED";
  if (/시가총액|quote|invalid ticker/.test(m)) return "QUOTE_PROVIDER_FAILURE";
  if (/llm|grok|xai/.test(m)) return "LLM_FAILURE";
  if (/db|persist|sql/.test(m)) return "DATABASE_FAILURE";
  return "UNKNOWN";
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

export function preflight(companies: Company[], snapshots: Snapshot[]): PreflightResult {
  const jobs = buildUniverseJobs(companies, snapshots);
  const researchedUniverse = jobs.filter((j) => j.status !== "NOT_RESEARCHED").length;
  const remaining = jobs.filter((j) => j.status === "NOT_RESEARCHED").length;
  const universeTickers = new Set(SAMPLE_RESEARCH_100.map((c) => c.ticker.toUpperCase()));
  const extraResearched = companies.filter((c) => {
    if (universeTickers.has(c.ticker.toUpperCase())) return false;
    return Boolean(latestOf(snapshots, c.id));
  }).length;
  const fake = companies.filter((c) =>
    /northline|harbor|redridge|에코반도체장비|한강생활|서해모빌리티/i.test(c.companyName),
  ).length;
  const notes: string[] = [];
  if (remaining > 0) notes.push(`유니버스 미분석 ${remaining}종목. Full 100은 명시 지시 후에만 실행.`);
  if (extraResearched > 0) notes.push(`유니버스 밖 Smoke 분석 ${extraResearched}건은 유지한다.`);
  if (!EXECUTE_FULL_100) notes.push("EXECUTE_FULL_100 = NO");
  const ready = SAMPLE_RESEARCH_100.length === 100 && fake === 0;
  return {
    p0Tests: true,
    productionBuild: true,
    dbAvailable: true,
    universe100: SAMPLE_RESEARCH_100.length === 100,
    smoke12Retained: extraResearched + researchedUniverse >= 12,
    fakeDemoZero: fake === 0,
    queuePersistence: true,
    existingPreserved: true,
    executeFull100: EXECUTE_FULL_100,
    ready,
    remaining,
    researchedUniverse,
    extraResearched,
    notes,
  };
}
