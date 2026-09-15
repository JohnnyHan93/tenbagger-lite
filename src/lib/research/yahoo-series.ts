import type { FinancialSeries, FinancialSeriesPoint, FinancialSnapshot, SourceTier } from "../types.ts";

const TYPES = [
  "annualTotalRevenue",
  "annualOperatingIncome",
  "annualNetIncome",
  "annualOperatingCashFlow",
  "annualFreeCashFlow",
  "annualCapitalExpenditure",
  "annualDilutedAverageShares",
  "annualOrdinarySharesNumber",
  "annualTotalDebt",
  "annualNetPPE",
  "annualDilutedEPS",
  "annualInvestedCapital",
  "quarterlyTotalRevenue",
] as const;

const FIELD_OF: Record<string, keyof FinancialSeriesPoint> = {
  annualTotalRevenue: "revenue",
  annualOperatingIncome: "operatingIncome",
  annualNetIncome: "netIncome",
  annualOperatingCashFlow: "cfo",
  annualFreeCashFlow: "fcf",
  annualCapitalExpenditure: "capex",
  annualDilutedAverageShares: "dilutedShares",
  annualOrdinarySharesNumber: "dilutedShares",
  annualTotalDebt: "debt",
  annualNetPPE: "ppe",
  annualDilutedEPS: "epsDiluted",
  annualInvestedCapital: "investedCapital",
  quarterlyTotalRevenue: "revenue",
};

export type YahooTimeseriesPayload = {
  timeseries?: {
    result?: Array<
      Record<string, unknown> & {
        meta?: { type?: string[] };
      }
    >;
  };
};

function rawOf(row: unknown): number | null {
  if (!row || typeof row !== "object") return null;
  const v = (row as { reportedValue?: { raw?: unknown } }).reportedValue?.raw;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asOfOf(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const d = (row as { asOfDate?: unknown }).asOfDate;
  return typeof d === "string" && d.length >= 8 ? d : null;
}

export function parseYahooTimeseries(payload: YahooTimeseriesPayload): FinancialSeries | null {
  const results = payload.timeseries?.result ?? [];
  const byPeriod = new Map<string, FinancialSeriesPoint>();
  const provenance: FinancialSeries["provenance"] = [];

  for (const item of results) {
    const type = item.meta?.type?.[0];
    if (!type) continue;
    const field = FIELD_OF[type];
    if (!field) continue;
    const periodType: FinancialSeriesPoint["periodType"] = type.startsWith("quarterly") ? "Q" : "FY";
    const rows = item[type];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const asOf = asOfOf(row);
      const raw = rawOf(row);
      if (!asOf || raw == null) continue;
      const key = `${periodType}:${asOf}`;
      const prev: FinancialSeriesPoint = byPeriod.get(key) ?? { period: asOf, periodType };
      if (field === "revenue") prev.revenue = prev.revenue ?? raw;
      else if (field === "operatingIncome") prev.operatingIncome = prev.operatingIncome ?? raw;
      else if (field === "netIncome") prev.netIncome = prev.netIncome ?? raw;
      else if (field === "cfo") prev.cfo = prev.cfo ?? raw;
      else if (field === "fcf") prev.fcf = prev.fcf ?? raw;
      else if (field === "dilutedShares") prev.dilutedShares = prev.dilutedShares ?? raw;
      else if (field === "debt") prev.debt = prev.debt ?? raw;
      else if (field === "ppe") prev.ppe = prev.ppe ?? raw;
      else if (field === "capex") prev.capex = prev.capex ?? raw;
      else if (field === "epsDiluted") prev.epsDiluted = prev.epsDiluted ?? raw;
      else if (field === "investedCapital") prev.investedCapital = prev.investedCapital ?? raw;
      byPeriod.set(key, prev);
    }
  }

  const points = [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
  if (points.length === 0) return null;

  for (const p of points) {
    provenance.push({
      period: p.period,
      sourceTier: "TIER_2" as SourceTier,
      sourceName: "Yahoo fundamentals timeseries",
      sourceUrl: "https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries",
    });
  }
  return { points, provenance };
}

export function financialsFromSeries(series: FinancialSeries | null): Partial<FinancialSnapshot> {
  if (!series) return {};
  const fy = series.points.filter((p) => p.periodType === "FY").sort((a, b) => a.period.localeCompare(b.period));
  const last = fy.at(-1);
  const prior = fy.at(-2);
  if (!last) return {};
  return {
    revenueTtm: last.revenue ?? null,
    revenuePrior: prior?.revenue ?? null,
    operatingIncomeTtm: last.operatingIncome ?? null,
    netIncomeTtm: last.netIncome ?? null,
    cfo: last.cfo ?? null,
    fcf: last.fcf ?? null,
    fcfSource: last.fcf != null ? "REPORTED" : null,
    totalDebt: last.debt ?? null,
    sharesOutstanding: last.dilutedShares ?? null,
  };
}

export function yahooTimeseriesUrl(ticker: string, now = Date.now()): string {
  const period1 = 1420070400;
  const period2 = Math.floor(now / 1000);
  const type = TYPES.join(",");
  return `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(ticker)}?type=${type}&period1=${period1}&period2=${period2}`;
}

export function mergeSeries(a: FinancialSeries | null | undefined, b: FinancialSeries | null | undefined): FinancialSeries | null {
  if (!a?.points?.length) return b ?? null;
  if (!b?.points?.length) return a;
  const byKey = new Map<string, FinancialSeriesPoint>();
  const prov = [...(a.provenance ?? []), ...(b.provenance ?? [])];
  for (const p of [...a.points, ...b.points]) {
    const key = `${p.periodType}:${p.period}`;
    const prev = byKey.get(key) ?? { period: p.period, periodType: p.periodType };
    byKey.set(key, {
      ...prev,
      revenue: prev.revenue ?? p.revenue,
      operatingIncome: prev.operatingIncome ?? p.operatingIncome,
      netIncome: prev.netIncome ?? p.netIncome,
      cfo: prev.cfo ?? p.cfo,
      fcf: prev.fcf ?? p.fcf,
      dilutedShares: prev.dilutedShares ?? p.dilutedShares,
      debt: prev.debt ?? p.debt,
      ppe: prev.ppe ?? p.ppe,
      capex: prev.capex ?? p.capex,
      epsDiluted: prev.epsDiluted ?? p.epsDiluted,
      investedCapital: prev.investedCapital ?? p.investedCapital,
    });
  }
  return {
    points: [...byKey.values()].sort((x, y) => x.period.localeCompare(y.period)),
    provenance: prov,
  };
}
