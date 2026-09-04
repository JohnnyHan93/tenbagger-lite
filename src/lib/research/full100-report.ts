import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { buildCoverageReport } from "./coverage-report.ts";
import { buildResearchGaps } from "./gaps.ts";
import { researchStatusOf } from "./coverage-report.ts";
import { tickersEqual } from "../format.ts";
import { countFakeDemo } from "./jobs.ts";

function latestOf(snapshots: Snapshot[], companyId: string): Snapshot | undefined {
  return snapshots
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function pct(n: number): number {
  return Math.round(n * 1000) / 10;
}

export interface LeaderRow {
  ticker: string;
  company: string;
  country: string;
  score: number | null;
  coverage: number;
  confidence: string;
  engineStatus: string;
  keyEvidence: string;
  primaryRisk: string;
  topResearchGap: string;
  earlySignal: boolean;
  adapter: string;
  provider: string;
}

function evidenceLine(s: Snapshot): string {
  const ev = [...(s.evidence ?? [])].sort((a, b) => {
    const rank = (t?: string) => (t === "TIER_1" ? 0 : t === "TIER_2" ? 1 : 2);
    return rank(a.sourceTier) - rank(b.sourceTier);
  })[0];
  if (!ev) return "—";
  const text = (ev.statement || ev.evidence || ev.title || "").slice(0, 140);
  return `${ev.sourceTier ?? "TIER_3"} · ${text || ev.sourceName || "evidence"}`;
}

function toLeader(company: Company, s: Snapshot, score: number | null, scale: "100" | "10" = "100"): LeaderRow {
  const gaps = buildResearchGaps(s, company);
  const coverage = s.overallCoverage;
  const highScore = score != null && (scale === "10" ? score >= 7 : score >= 70);
  return {
    ticker: company.ticker,
    company: company.companyName,
    country: company.country,
    score,
    coverage,
    confidence: s.overallConfidence,
    engineStatus: researchStatusOf(s),
    keyEvidence: evidenceLine(s),
    primaryRisk: s.risks?.[0] ?? "—",
    topResearchGap: gaps[0]?.field ?? "—",
    earlySignal: highScore && coverage < 0.7,
    adapter: s.industryAdapter ?? "Other",
    provider: s.researchProvider,
  };
}

const SAMPLE_TICKERS = new Set(SAMPLE_RESEARCH_100.map((c) => c.ticker.toUpperCase()));

function sampleRows(companies: Company[], snapshots: Snapshot[]) {
  return SAMPLE_RESEARCH_100.map((ident) => {
    const company =
      companies.find((c) => tickersEqual(c.ticker, ident.ticker)) ??
      companies.find((c) => c.ticker.replace(/\.(KS|KQ)$/i, "") === ident.ticker.replace(/\.(KS|KQ)$/i, ""));
    const snap = company ? latestOf(snapshots, company.id) : undefined;
    return { ident, company, snap };
  });
}

export function buildFull100Report(companies: Company[], snapshots: Snapshot[]) {
  const rows = sampleRows(companies, snapshots);
  const analyzed = rows.filter((r) => r.snap);
  const coverage = buildCoverageReport(
    analyzed.map((r) => r.company!),
    snapshots,
  );
  const us = analyzed.filter((r) => r.ident.country !== "KR");
  const kr = analyzed.filter((r) => r.ident.country === "KR");
  const split = (list: typeof analyzed) => ({
    n: list.length,
    xbagger: list.length ? list.reduce((s, r) => s + (r.snap?.xbagger.coverage ?? 0), 0) / list.length : 0,
    oversold: list.length ? list.reduce((s, r) => s + (r.snap?.oversold.coverage ?? 0), 0) / list.length : 0,
    quality: list.length ? list.reduce((s, r) => s + (r.snap?.quality.coverage ?? 0), 0) / list.length : 0,
    overall: list.length ? list.reduce((s, r) => s + (r.snap?.overallCoverage ?? 0), 0) / list.length : 0,
  });

  const xLeaders = analyzed
    .filter((r) => r.company && r.snap)
    .map((r) => toLeader(r.company!, r.snap!, r.snap!.xbagger.adjustedScore))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 8);

  const oLeaders = analyzed
    .filter((r) => r.company && r.snap && r.snap.oversold.opportunity != null)
    .map((r) => toLeader(r.company!, r.snap!, r.snap!.oversold.opportunity, "10"))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 8);

  const qLeaders = analyzed
    .filter((r) => r.company && r.snap && r.snap.quality.score != null)
    .map((r) => toLeader(r.company!, r.snap!, r.snap!.quality.score))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 8);

  const cross = analyzed
    .filter((r) => r.company && r.snap)
    .map((r) => ({
      ...toLeader(r.company!, r.snap!, r.snap!.researchPriority),
      score: r.snap!.researchPriority,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 8);

  const adapterNames = [
    "Software",
    "Semiconductor",
    "Industrial",
    "Healthcare",
    "Financial",
    "REIT",
    "Biotech",
    "Other",
  ];
  const adapters = adapterNames.map((name) => {
    const list = analyzed.filter((r) => (r.snap?.industryAdapter ?? "Other") === name);
    const status = (st: string) => list.filter((r) => r.snap && researchStatusOf(r.snap) === st).length;
    return {
      adapter: name,
      companies: list.length,
      avgCoverage: list.length ? list.reduce((s, r) => s + (r.snap?.overallCoverage ?? 0), 0) / list.length : 0,
      COMPLETE: status("COMPLETE"),
      PARTIAL: status("PARTIAL"),
      RESEARCH_REQUIRED: status("RESEARCH_REQUIRED"),
      FAILED: 0,
    };
  });

  const extraAdapters = new Map<string, typeof analyzed>();
  for (const r of analyzed) {
    const name = r.snap?.industryAdapter ?? "Other";
    if (adapterNames.includes(name)) continue;
    const list = extraAdapters.get(name) ?? [];
    list.push(r);
    extraAdapters.set(name, list);
  }
  for (const [name, list] of extraAdapters) {
    const status = (st: string) => list.filter((r) => r.snap && researchStatusOf(r.snap) === st).length;
    adapters.push({
      adapter: name,
      companies: list.length,
      avgCoverage: list.length ? list.reduce((s, r) => s + (r.snap?.overallCoverage ?? 0), 0) / list.length : 0,
      COMPLETE: status("COMPLETE"),
      PARTIAL: status("PARTIAL"),
      RESEARCH_REQUIRED: status("RESEARCH_REQUIRED"),
      FAILED: 0,
    });
  }

  const gapFreq = new Map<string, { field: string; engine: string; impact: string; n: number }>();
  for (const r of analyzed) {
    if (!r.snap || !r.company) continue;
    for (const g of buildResearchGaps(r.snap, r.company).slice(0, 8)) {
      const key = `${g.engine}:${g.field}`;
      const cur = gapFreq.get(key) ?? { field: g.field, engine: g.engine, impact: g.impact, n: 0 };
      cur.n += 1;
      if (g.impact === "HIGH") cur.impact = "HIGH";
      gapFreq.set(key, cur);
    }
  }
  const gaps = [...gapFreq.values()].sort((a, b) => {
    const impact = (x: string) => (x === "HIGH" ? 0 : x === "MEDIUM" ? 1 : 2);
    if (impact(a.impact) !== impact(b.impact)) return impact(a.impact) - impact(b.impact);
    return b.n - a.n;
  });

  let tier1 = 0,
    tier2 = 0,
    tier3 = 0,
    manual = 0,
    active = 0,
    stale = 0,
    conflicted = 0,
    invalidated = 0,
    totalEv = 0;
  for (const r of analyzed) {
    for (const ev of r.snap?.evidence ?? []) {
      totalEv += 1;
      if (ev.sourceTier === "TIER_1") tier1 += 1;
      else if (ev.sourceTier === "TIER_2") tier2 += 1;
      else if (ev.sourceTier === "MANUAL") manual += 1;
      else tier3 += 1;
      if (ev.status === "STALE") stale += 1;
      else if (ev.status === "CONFLICTED") conflicted += 1;
      else if (ev.status === "INVALIDATED") invalidated += 1;
      else active += 1;
    }
  }

  const providers = { grok: 0, filings: 0, other: 0 };
  for (const r of analyzed) {
    const p = r.snap?.researchProvider ?? "";
    if (/grok/i.test(p)) providers.grok += 1;
    else if (/filing|profile|heuristic/i.test(p)) providers.filings += 1;
    else providers.other += 1;
  }

  const extraSmoke = companies.filter((c) => {
    if (SAMPLE_TICKERS.has(c.ticker.toUpperCase())) return false;
    return snapshots.some((s) => s.companyId === c.id);
  });

  return {
    universe: {
      sample100: SAMPLE_RESEARCH_100.length,
      us: SAMPLE_RESEARCH_100.filter((c) => c.country !== "KR").length,
      kr: SAMPLE_RESEARCH_100.filter((c) => c.country === "KR").length,
      analyzed: analyzed.length,
      remaining: rows.length - analyzed.length,
      fakeDemo: countFakeDemo(companies),
      extraSmoke: extraSmoke.length,
      extraSmokeTickers: extraSmoke.map((c) => c.ticker),
    },
    coverage: {
      xbaggerAvg: coverage.xbaggerAvg,
      oversoldAvg: coverage.oversoldAvg,
      qualityAvg: coverage.qualityAvg,
      medianOverall: coverage.medianOverall,
      us: split(us),
      kr: split(kr),
      engines: coverage.engines,
    },
    adapters,
    evidence: { total: totalEv, TIER_1: tier1, TIER_2: tier2, TIER_3: tier3, MANUAL: manual, ACTIVE: active, STALE: stale, CONFLICTED: conflicted, INVALIDATED: invalidated },
    ai: providers,
    gaps: gaps.slice(0, 16),
    leaders: {
      xbagger: xLeaders,
      oversold: oLeaders,
      quality: qLeaders,
      cross: cross,
    },
    fmt: {
      xbaggerAvg: pct(coverage.xbaggerAvg),
      oversoldAvg: pct(coverage.oversoldAvg),
      qualityAvg: pct(coverage.qualityAvg),
      medianOverall: pct(coverage.medianOverall),
    },
  };
}
