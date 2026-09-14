import type { FinancialSeries, FinancialSeriesPoint, SourceTier } from "../types.ts";

export function pointsOf(series: FinancialSeries | null | undefined, type: "FY" | "Q"): FinancialSeriesPoint[] {
  if (!series?.points?.length) return [];
  return series.points
    .filter((p) => p.periodType === type)
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function numericField(points: FinancialSeriesPoint[], field: keyof FinancialSeriesPoint): Array<number> {
  const out: number[] = [];
  for (const p of points) {
    const v = p[field];
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** TIER_3-only provenance is not used for auto-scoring. No provenance → caller-supplied points are allowed. */
export function seriesTrusted(series: FinancialSeries | null | undefined): boolean {
  if (!series?.points?.length) return false;
  const prov = series.provenance;
  if (!prov?.length) return true;
  const usable: SourceTier[] = ["TIER_1", "TIER_2", "MANUAL"];
  return prov.some((p) => p.sourceTier != null && usable.includes(p.sourceTier));
}

export function qoqChange(series: FinancialSeries | null | undefined, field: keyof FinancialSeriesPoint = "revenue"): number | null {
  if (!seriesTrusted(series)) return null;
  const pts = pointsOf(series, "Q");
  const vals = numericField(pts, field);
  if (vals.length < 2) return null;
  const a = vals[vals.length - 2];
  const b = vals[vals.length - 1];
  if (a === 0) return null;
  return b / a - 1;
}

export function yoyFromFy(series: FinancialSeries | null | undefined, field: keyof FinancialSeriesPoint): number | null {
  if (!seriesTrusted(series)) return null;
  const vals = numericField(pointsOf(series, "FY"), field);
  if (vals.length < 2) return null;
  const a = vals[vals.length - 2];
  const b = vals[vals.length - 1];
  if (a === 0) return null;
  return b / a - 1;
}

export function spanChange(series: FinancialSeries | null | undefined, field: keyof FinancialSeriesPoint, n: number): number | null {
  if (!seriesTrusted(series)) return null;
  const vals = numericField(pointsOf(series, "FY"), field);
  if (vals.length < n) return null;
  const first = vals[vals.length - n];
  const last = vals[vals.length - 1];
  if (first === 0) return null;
  return last / first - 1;
}

export function fyCount(series: FinancialSeries | null | undefined, field: keyof FinancialSeriesPoint): number {
  if (!seriesTrusted(series)) return 0;
  return numericField(pointsOf(series, "FY"), field).length;
}
