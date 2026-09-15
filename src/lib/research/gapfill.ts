import { tickersEqual } from "../format.ts";
import { uid } from "../utils.ts";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import { persistBackend, persistIsDurable } from "../persist/durable.ts";
import { researchStatusOf } from "./coverage-report.ts";
import { lookupIdentity } from "./identity.ts";
import { seriesTrusted } from "../metrics/series.ts";
import type { Snapshot } from "../domain/snapshot.ts";

export const GAPFILL_EPHEMERAL = "GAPFILL_EPHEMERAL";
export const GAPFILL_NOT_UNIVERSE = "GAPFILL_NOT_UNIVERSE";

export type GapFillRow = {
  ticker: string;
  name: string;
  country: string;
  qualityCoverage: number | null;
  fyPoints: number;
  needsFill: boolean;
  status: string | null;
};

export type GapFillStatus = {
  backend: "neon" | "pglite";
  durable: boolean;
  filled: number;
  remaining: number;
  remainingTickers: string[];
  rows: GapFillRow[];
};

export type GapFillOneResult = {
  ok: boolean;
  ticker: string;
  skipped?: boolean;
  status?: string;
  qualityCoverage?: number;
  fyPoints?: number;
  error?: string;
};

function fyPointCount(snap: Snapshot | undefined): number {
  const series = snap?.derived?.series;
  if (!seriesTrusted(series)) return 0;
  return series?.points.filter((p) => p.periodType === "FY").length ?? 0;
}

function attemptedSeriesFetch(snap: Snapshot | undefined): boolean {
  return (snap?.sourceAttempts ?? []).some((a) => a.provider === "yahoo-timeseries");
}

/** Remaining = missing internet series, not RESEARCH_REQUIRED. Overall coverage stays honest. */
export function snapshotNeedsGapFill(snap: Snapshot | undefined): boolean {
  if (!snap) return true;
  if (fyPointCount(snap) >= 3) return false;
  if (attemptedSeriesFetch(snap)) return false;
  return true;
}

export async function gapfillStatus(): Promise<GapFillStatus> {
  const { loadWorkspace } = await import("../persist/repo.ts");
  const ws = await loadWorkspace();
  const rows: GapFillRow[] = SAMPLE_RESEARCH_100.map((ident) => {
    const company = ws.companies.find((c) => tickersEqual(c.ticker, ident.ticker));
    const snap = company
      ? ws.snapshots
          .filter((s) => s.companyId === company.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined;
    return {
      ticker: ident.ticker,
      name: ident.companyName,
      country: ident.country,
      qualityCoverage: snap?.quality.coverage ?? null,
      fyPoints: fyPointCount(snap),
      needsFill: snapshotNeedsGapFill(snap),
      status: snap ? researchStatusOf(snap) : null,
    };
  });
  const remainingTickers = rows.filter((r) => r.needsFill).map((r) => r.ticker);
  return {
    backend: persistBackend(),
    durable: persistIsDurable(),
    filled: rows.length - remainingTickers.length,
    remaining: remainingTickers.length,
    remainingTickers,
    rows,
  };
}

export async function gapfillResearchOne(ticker: string): Promise<GapFillOneResult> {
  if (!SAMPLE_RESEARCH_100.some((c) => tickersEqual(c.ticker, ticker))) {
    return { ok: false, ticker, error: GAPFILL_NOT_UNIVERSE };
  }
  if (!persistIsDurable()) {
    return { ok: false, ticker, error: GAPFILL_EPHEMERAL };
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
  if (prior && !snapshotNeedsGapFill(prior)) {
    return {
      ok: true,
      ticker: existing?.ticker ?? ticker,
      skipped: true,
      status: researchStatusOf(prior),
      qualityCoverage: prior.quality.coverage,
      fyPoints: fyPointCount(prior),
    };
  }

  const res = await executeResearch({ ticker, useAi: true });
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
    qualityCoverage: snapshot.quality.coverage,
    fyPoints: fyPointCount(snapshot),
  };
}
