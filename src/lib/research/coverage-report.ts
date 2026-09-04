import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";

function latestOf(snapshots: Snapshot[], companyId: string): Snapshot | undefined {
  return snapshots
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export interface EngineCoverageRow {
  engine: string;
  us: number;
  kr: number;
  gap: number;
}

export interface AdapterCoverageRow {
  adapter: string;
  companies: number;
  avgCoverage: number;
  researchRequired: number;
  failed: number;
}

export interface CoverageReport {
  analyzed: number;
  usAnalyzed: number;
  krAnalyzed: number;
  xbaggerAvg: number;
  oversoldAvg: number;
  qualityAvg: number;
  medianOverall: number;
  lowCoverage: number;
  highConfidence: number;
  lowConfidence: number;
  engines: EngineCoverageRow[];
  adapters: AdapterCoverageRow[];
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function buildCoverageReport(companies: Company[], snapshots: Snapshot[]): CoverageReport {
  const rows = companies
    .map((c) => ({ c, s: latestOf(snapshots, c.id) }))
    .filter((r): r is { c: Company; s: Snapshot } => Boolean(r.s));
  const us = rows.filter((r) => r.c.country !== "KR");
  const kr = rows.filter((r) => r.c.country === "KR");
  const mean = (list: typeof rows, pick: (s: Snapshot) => number) => avg(list.map((r) => pick(r.s)));
  const engines: EngineCoverageRow[] = [
    {
      engine: "X-Bagger",
      us: mean(us, (s) => s.xbagger.coverage),
      kr: mean(kr, (s) => s.xbagger.coverage),
      gap: 0,
    },
    {
      engine: "Oversold",
      us: mean(us, (s) => s.oversold.coverage),
      kr: mean(kr, (s) => s.oversold.coverage),
      gap: 0,
    },
    {
      engine: "Quality 70",
      us: mean(us, (s) => s.quality.coverage),
      kr: mean(kr, (s) => s.quality.coverage),
      gap: 0,
    },
  ].map((e) => ({ ...e, gap: e.us - e.kr }));

  const byAdapter = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.s.industryAdapter ?? "Other";
    const list = byAdapter.get(key) ?? [];
    list.push(r);
    byAdapter.set(key, list);
  }
  const adapters: AdapterCoverageRow[] = [...byAdapter.entries()]
    .map(([adapter, list]) => ({
      adapter,
      companies: list.length,
      avgCoverage: avg(list.map((r) => r.s.overallCoverage)),
      researchRequired: list.filter((r) => r.s.tags.includes("RESEARCH REQUIRED")).length,
      failed: 0,
    }))
    .sort((a, b) => b.companies - a.companies);

  const overalls = rows.map((r) => r.s.overallCoverage);
  return {
    analyzed: rows.length,
    usAnalyzed: us.length,
    krAnalyzed: kr.length,
    xbaggerAvg: avg(rows.map((r) => r.s.xbagger.coverage)),
    oversoldAvg: avg(rows.map((r) => r.s.oversold.coverage)),
    qualityAvg: avg(rows.map((r) => r.s.quality.coverage)),
    medianOverall: median(overalls),
    lowCoverage: rows.filter((r) => r.s.overallCoverage < 0.5).length,
    highConfidence: rows.filter((r) => r.s.overallConfidence === "High").length,
    lowConfidence: rows.filter((r) => r.s.overallConfidence === "Low").length,
    engines,
    adapters,
  };
}

export function researchStatusOf(s: Snapshot): "COMPLETE" | "PARTIAL" | "RESEARCH_REQUIRED" {
  if (s.tags.includes("RESEARCH REQUIRED") || s.overallCoverage < 0.7) return "RESEARCH_REQUIRED";
  if (s.xbagger.status === "COMPLETE" && s.oversold.status === "COMPLETE" && s.quality.status === "COMPLETE") {
    return "COMPLETE";
  }
  return "PARTIAL";
}
