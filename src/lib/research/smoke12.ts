import { tickersEqual } from "../format.ts";
import { uid } from "../utils.ts";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import { persistBackend, persistIsDurable } from "../persist/durable.ts";
import { researchStatusOf } from "./coverage-report.ts";
import { SMOKE_12, SMOKE_12_TICKERS, lookupIdentity } from "./identity.ts";

export { SMOKE_12, SMOKE_12_TICKERS };

export const SMOKE12_EPHEMERAL = "SMOKE12_EPHEMERAL";
export const SMOKE12_UNKNOWN_TICKER = "SMOKE12_UNKNOWN_TICKER";

export type Smoke12Row = {
  ticker: string;
  name: string;
  country: "US" | "KR";
  inUniverse: boolean;
  hasSnapshot: boolean;
  status: string | null;
  provider: string | null;
};

export type Smoke12Status = {
  backend: "neon" | "pglite";
  durable: boolean;
  rows: Smoke12Row[];
  done: number;
  remaining: number;
  universeDone: number;
  extraDone: number;
};

export type Smoke12OneResult = {
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

export function smoke12Membership(): { universe: string[]; extra: string[] } {
  const universe = SMOKE_12_TICKERS.filter(inSample100);
  const extra = SMOKE_12_TICKERS.filter((t) => !inSample100(t));
  return { universe, extra };
}

export async function smoke12Status(): Promise<Smoke12Status> {
  const { loadWorkspace } = await import("../persist/repo.ts");
  const ws = await loadWorkspace();
  const rows: Smoke12Row[] = SMOKE_12.map((ident) => {
    const company = ws.companies.find(
      (c) => tickersEqual(c.ticker, ident.ticker) || ident.aliases.some((a) => tickersEqual(c.ticker, a)),
    );
    const snap = company
      ? ws.snapshots
          .filter((s) => s.companyId === company.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    return {
      ticker: ident.ticker,
      name: ident.companyName,
      country: ident.country,
      inUniverse: inSample100(ident.ticker),
      hasSnapshot: Boolean(snap),
      status: snap ? researchStatusOf(snap) : null,
      provider: snap?.researchProvider ?? null,
    };
  });
  const done = rows.filter((r) => r.hasSnapshot).length;
  return {
    backend: persistBackend(),
    durable: persistIsDurable(),
    rows,
    done,
    remaining: rows.length - done,
    universeDone: rows.filter((r) => r.inUniverse && r.hasSnapshot).length,
    extraDone: rows.filter((r) => !r.inUniverse && r.hasSnapshot).length,
  };
}

export async function smoke12ResearchOne(
  ticker: string,
  opts?: { useAi?: boolean; force?: boolean },
): Promise<Smoke12OneResult> {
  if (!SMOKE_12.some((s) => tickersEqual(s.ticker, ticker) || s.aliases.some((a) => tickersEqual(a, ticker)))) {
    return { ok: false, ticker, error: SMOKE12_UNKNOWN_TICKER };
  }
  if (!persistIsDurable()) {
    return { ok: false, ticker, error: SMOKE12_EPHEMERAL };
  }

  const { executeResearch } = await import("./ticker.ts");
  const { runSnapshotFromDraft } = await import("../engines/run.ts");
  const { loadWorkspace, saveAnalysisTransaction } = await import("../persist/repo.ts");

  const ws = await loadWorkspace();
  const existing = ws.companies.find(
    (c) => tickersEqual(c.ticker, ticker) || SMOKE_12.some((s) => tickersEqual(s.ticker, ticker) && s.aliases.some((a) => tickersEqual(c.ticker, a))),
  );
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
