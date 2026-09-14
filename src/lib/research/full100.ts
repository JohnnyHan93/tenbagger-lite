import { tickersEqual } from "../format.ts";
import { uid } from "../utils.ts";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import { persistBackend, persistIsDurable } from "../persist/durable.ts";
import { researchStatusOf } from "./coverage-report.ts";
import { lookupIdentity } from "./identity.ts";
import {
  EXECUTE_FULL_100,
  FULL100_EPHEMERAL,
  FULL100_EXECUTION_DISABLED,
} from "./jobs.ts";

export { FULL100_EPHEMERAL, FULL100_EXECUTION_DISABLED };

export const FULL100_NOT_UNIVERSE = "FULL100_NOT_UNIVERSE";

export type Full100Row = {
  ticker: string;
  name: string;
  country: "US" | "KR";
  hasSnapshot: boolean;
  status: string | null;
};

export type Full100Status = {
  backend: "neon" | "pglite";
  durable: boolean;
  authorized: boolean;
  researched: number;
  remaining: number;
  extraPreserved: number;
  remainingTickers: string[];
  rows: Full100Row[];
};

export type Full100OneResult = {
  ok: boolean;
  ticker: string;
  skipped?: boolean;
  status?: string;
  provider?: string;
  error?: string;
};

function inSample100(ticker: string): boolean {
  return SAMPLE_RESEARCH_100.some((c) => tickersEqual(c.ticker, ticker));
}

export async function full100Status(): Promise<Full100Status> {
  const { loadWorkspace } = await import("../persist/repo.ts");
  const ws = await loadWorkspace();
  const universeTickers = new Set(SAMPLE_RESEARCH_100.map((c) => c.ticker.toUpperCase()));
  const extraPreserved = ws.companies.filter((c) => {
    if (universeTickers.has(c.ticker.toUpperCase())) return false;
    return ws.snapshots.some((s) => s.companyId === c.id);
  }).length;

  const rows: Full100Row[] = SAMPLE_RESEARCH_100.map((ident) => {
    const company = ws.companies.find((c) => tickersEqual(c.ticker, ident.ticker));
    const snap = company
      ? ws.snapshots
          .filter((s) => s.companyId === company.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    return {
      ticker: ident.ticker,
      name: ident.companyName,
      country: ident.country === "KR" ? "KR" : "US",
      hasSnapshot: Boolean(snap),
      status: snap ? researchStatusOf(snap) : null,
    };
  });
  const remainingTickers = rows.filter((r) => !r.hasSnapshot).map((r) => r.ticker);
  return {
    backend: persistBackend(),
    durable: persistIsDurable(),
    authorized: EXECUTE_FULL_100,
    researched: rows.filter((r) => r.hasSnapshot).length,
    remaining: remainingTickers.length,
    extraPreserved,
    remainingTickers,
    rows,
  };
}

export async function full100ResearchOne(
  ticker: string,
  opts?: { useAi?: boolean; force?: boolean },
): Promise<Full100OneResult> {
  if (!inSample100(ticker)) {
    return { ok: false, ticker, error: FULL100_NOT_UNIVERSE };
  }
  if (!EXECUTE_FULL_100) {
    return { ok: false, ticker, error: FULL100_EXECUTION_DISABLED };
  }
  if (!persistIsDurable()) {
    return { ok: false, ticker, error: FULL100_EPHEMERAL };
  }

  const { executeResearch } = await import("./ticker.ts");
  const { runSnapshotFromDraft } = await import("../engines/run.ts");
  const { loadWorkspace, saveAnalysisTransaction } = await import("../persist/repo.ts");

  const ws = await loadWorkspace();
  const existing = ws.companies.find((c) => tickersEqual(c.ticker, ticker));
  const prior = existing
    ? ws.snapshots
        .filter((s) => s.companyId === existing.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined;
  if (prior && !opts?.force) {
    return {
      ok: true,
      ticker: existing?.ticker ?? ticker,
      skipped: true,
      status: researchStatusOf(prior),
      provider: prior.researchProvider,
    };
  }

  const res = await executeResearch({ ticker, useAi: opts?.useAi ?? true });
  if (!res.ok) return { ok: false, ticker, error: res.error };

  const ident = lookupIdentity(res.draft.quote.ticker) ?? lookupIdentity(ticker);
  const now = new Date().toISOString();
  const q = res.draft.quote;
  const company = existing ?? {
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
  await saveAnalysisTransaction({ company, snapshot });
  return {
    ok: true,
    ticker: company.ticker,
    status: researchStatusOf(snapshot),
    provider: snapshot.researchProvider,
  };
}
