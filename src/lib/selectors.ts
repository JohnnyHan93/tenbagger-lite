import { GRADE_THRESHOLDS } from "./scoring/config.ts";
import { latestSnapshot, previousSnapshot } from "./store.ts";
import type { Snapshot } from "./domain/snapshot.ts";
import type { Company } from "./types.ts";
import { isUsableCompany, isUsableSnapshot } from "./bootstrap.ts";
import {
  formatMeg,
  marketExpectationGap,
  oversoldAlerts,
  pricePathOf,
  type MegResult,
  type OversoldAlert,
  type PricePathResult,
} from "./engines/oversold-monitor.ts";

export interface RankRow {
  rank: number;
  company: Company;
  snapshot: Snapshot;
}

export interface RosterRow {
  rank: number | null;
  company: Company;
  snapshot: Snapshot | null;
  pending: boolean;
}

export function rankCompanies(companies: Company[], snapshots: Snapshot[]): RankRow[] {
  return companies
    .filter(isUsableCompany)
    .map((company) => {
      const snapshot = latestSnapshot(snapshots, company.id);
      if (!isUsableSnapshot(snapshot)) return null;
      return { company, snapshot };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => {
      const rp = (b.snapshot.researchPriority ?? 0) - (a.snapshot.researchPriority ?? 0);
      if (rp) return rp;
      return b.snapshot.xbagger.adjustedScore - a.snapshot.xbagger.adjustedScore;
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function dashboardStats(companies: Company[], snapshots: Snapshot[]) {
  const usable = companies.filter(isUsableCompany);
  const latest = usable
    .map((c) => latestSnapshot(snapshots, c.id))
    .filter((a): a is Snapshot => isUsableSnapshot(a));
  const xDeep = latest.filter((s) => s.xbagger.grade === "S" || s.xbagger.grade === "A").length;
  const qualityHigh = latest.filter((s) => (s.quality.score ?? 0) >= 70).length;
  const oversold = latest.filter((s) => (s.oversold.opportunity ?? 0) >= 6.5 && s.oversold.valueTrap < 7).length;
  const research = latest.filter((s) => s.tags.includes("RESEARCH REQUIRED")).length;
  const stale = latest.filter((s) => Date.now() - new Date(s.asOf).getTime() > 14 * 86400000).length;
  const pending = usable.filter((c) => !latestSnapshot(snapshots, c.id)).length;
  const us = usable.filter((c) => c.country !== "KR").length;
  const kr = usable.filter((c) => c.country === "KR").length;
  return { xDeep, qualityHigh, oversold, research, stale, total: usable.length, analyzed: latest.length, pending, us, kr };
}

export function rosterCompanies(companies: Company[], snapshots: Snapshot[]): RosterRow[] {
  const usable = companies.filter(isUsableCompany);
  const scored = rankCompanies(usable, snapshots);
  const scoredIds = new Set(scored.map((r) => r.company.id));
  const pending = usable
    .filter((c) => !scoredIds.has(c.id))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  return [
    ...scored.map((r) => ({ rank: r.rank, company: r.company, snapshot: r.snapshot, pending: false })),
    ...pending.map((company) => ({ rank: null, company, snapshot: null, pending: true })),
  ];
}

export function oversoldRank(companies: Company[], snapshots: Snapshot[], market: "KR" | "US") {
  return companies
    .filter(isUsableCompany)
    .filter((c) => c.country === market)
    .map((company) => {
      const snapshot = latestSnapshot(snapshots, company.id);
      if (!isUsableSnapshot(snapshot) || snapshot.oversold.opportunity == null) return null;
      return { company, snapshot };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.snapshot.oversold.opportunity ?? 0) - (a.snapshot.oversold.opportunity ?? 0))
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export interface OversoldMonitorRow {
  rank: number;
  prevRank: number | null;
  company: Company;
  snapshot: Snapshot;
  prev: Snapshot | null;
  meg: MegResult;
  path: PricePathResult;
  alerts: OversoldAlert[];
  oppDelta: number | null;
}

export function oversoldMonitorRank(
  companies: Company[],
  snapshots: Snapshot[],
  market: "KR" | "US",
): OversoldMonitorRow[] {
  const pool = companies.filter(isUsableCompany).filter((c) => c.country === market);
  const current = pool
    .map((company) => {
      const snapshot = latestSnapshot(snapshots, company.id);
      if (!isUsableSnapshot(snapshot) || snapshot.oversold.opportunity == null) return null;
      return { company, snapshot };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.snapshot.oversold.opportunity ?? 0) - (a.snapshot.oversold.opportunity ?? 0));

  const previous = pool
    .map((company) => {
      const snapshot = previousSnapshot(snapshots, company.id);
      if (!isUsableSnapshot(snapshot) || snapshot.oversold.opportunity == null) return null;
      return { company, snapshot };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.snapshot.oversold.opportunity ?? 0) - (a.snapshot.oversold.opportunity ?? 0));

  const prevRankOf = new Map(previous.map((r, i) => [r.company.id, i + 1]));
  const prevTop = new Set(previous.slice(0, 10).map((r) => r.company.id));
  const currTop = current.slice(0, 10);

  return currTop.map((r, i) => {
    const rank = i + 1;
    const prev = previousSnapshot(snapshots, r.company.id) ?? null;
    const inPrevTop = prevTop.has(r.company.id);
    const prevRank = inPrevTop ? (prevRankOf.get(r.company.id) ?? null) : null;
    const alerts = oversoldAlerts({
      prev,
      curr: r.snapshot,
      prevRank,
      currRank: rank,
    });
    const oppDelta =
      prev?.oversold.opportunity != null && r.snapshot.oversold.opportunity != null
        ? r.snapshot.oversold.opportunity - prev.oversold.opportunity
        : null;
    return {
      rank,
      prevRank,
      company: r.company,
      snapshot: r.snapshot,
      prev,
      meg: marketExpectationGap(r.snapshot.oversold),
      path: pricePathOf(r.snapshot.oversold),
      alerts,
      oppDelta,
    };
  });
}

export { formatMeg };

export function gradeTone(grade: string): "a" | "b" | "c" | "d" {
  if (grade === "S" || grade === "A") return "a";
  if (grade === "B") return "b";
  if (grade === "C") return "c";
  return "d";
}

export { GRADE_THRESHOLDS };
