import { GRADE_THRESHOLDS } from "./scoring/config";
import { latestAnalysis, needsRefresh, scoreChange } from "./store";
import type { Analysis, Company } from "./types";

export interface RankRow {
  rank: number;
  company: Company;
  analysis: Analysis;
  change: number | null;
}

export function rankCompanies(companies: Company[], analyses: Analysis[]): RankRow[] {
  const rows = companies
    .map((company) => {
      const analysis = latestAnalysis(analyses, company.id);
      if (!analysis) return null;
      return {
        company,
        analysis,
        change: scoreChange(analyses, company.id),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.analysis.adjustedScore - a.analysis.adjustedScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return rows;
}

export function dashboardStats(companies: Company[], analyses: Analysis[]) {
  const latest = companies
    .map((c) => latestAnalysis(analyses, c.id))
    .filter((a): a is Analysis => Boolean(a));
  const aCount = latest.filter((a) => a.grade === "A").length;
  const bCount = latest.filter((a) => a.grade === "B").length;
  const refresh = companies.filter((c) => needsRefresh(latestAnalysis(analyses, c.id))).length;
  const cutoff = Date.now() - 14 * 86400000;
  const newEvidence = analyses.reduce((n, a) => {
    return n + a.evidences.filter((e) => new Date(e.createdAt).getTime() >= cutoff).length;
  }, 0);
  return { aCount, bCount, refresh, newEvidence, total: latest.length };
}

export function gradeTone(grade: string): "a" | "b" | "c" | "d" {
  if (grade === "A") return "a";
  if (grade === "B") return "b";
  if (grade === "C") return "c";
  return "d";
}

export { GRADE_THRESHOLDS };
