import { GRADE_THRESHOLDS } from "./scoring/config.ts";
import { latestSnapshot } from "./store.ts";
import type { Snapshot } from "./domain/snapshot.ts";
import type { Company } from "./types.ts";

export interface RankRow {
  rank: number;
  company: Company;
  snapshot: Snapshot;
}

export function rankCompanies(companies: Company[], snapshots: Snapshot[]): RankRow[] {
  return companies
    .map((company) => {
      const snapshot = latestSnapshot(snapshots, company.id);
      if (!snapshot) return null;
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
  const latest = companies
    .map((c) => latestSnapshot(snapshots, c.id))
    .filter((a): a is Snapshot => Boolean(a));
  const xDeep = latest.filter((s) => s.xbagger.grade === "S" || s.xbagger.grade === "A").length;
  const qualityHigh = latest.filter((s) => (s.quality.score ?? 0) >= 70).length;
  const oversold = latest.filter((s) => (s.oversold.opportunity ?? 0) >= 6.5 && s.oversold.valueTrap < 7).length;
  const research = latest.filter((s) => s.tags.includes("RESEARCH REQUIRED")).length;
  const stale = latest.filter((s) => Date.now() - new Date(s.asOf).getTime() > 14 * 86400000).length;
  return { xDeep, qualityHigh, oversold, research, stale, total: latest.length };
}

export function oversoldRank(companies: Company[], snapshots: Snapshot[], market: "KR" | "US") {
  return companies
    .filter((c) => c.country === market)
    .map((company) => {
      const snapshot = latestSnapshot(snapshots, company.id);
      if (!snapshot || snapshot.oversold.opportunity == null) return null;
      return { company, snapshot };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.snapshot.oversold.opportunity ?? 0) - (a.snapshot.oversold.opportunity ?? 0))
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function gradeTone(grade: string): "a" | "b" | "c" | "d" {
  if (grade === "S" || grade === "A") return "a";
  if (grade === "B") return "b";
  if (grade === "C") return "c";
  return "d";
}

export { GRADE_THRESHOLDS };
