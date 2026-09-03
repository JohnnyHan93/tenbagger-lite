import { GRADE_THRESHOLDS } from "./scoring/config";
import { latestAnalysis, needsRefresh, scoreChange } from "./store";
import type { Analysis, Company } from "./types";

export interface RankRow {
  rank: number;
  company: Company;
  analysis: Analysis;
  change: number | null;
}

function factorOf(a: Analysis, code: Analysis["factorScores"][number]["factorCode"]): number {
  return a.factorScores.find((f) => f.factorCode === code)?.score ?? -1;
}

function gatePass(a: Analysis): number {
  if (a.hardStop || a.hardGates?.tenx === "FAIL" || a.hardGates?.survival === "FAIL") return 0;
  return 1;
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
    .sort((a, b) => {
      const gp = gatePass(b.analysis) - gatePass(a.analysis);
      if (gp) return gp;
      const sc = b.analysis.adjustedScore - a.analysis.adjustedScore;
      if (sc) return sc;
      const t = factorOf(b.analysis, "F10") - factorOf(a.analysis, "F10");
      if (t) return t;
      const m = factorOf(b.analysis, "F1") - factorOf(a.analysis, "F1");
      if (m) return m;
      const g = factorOf(b.analysis, "F2") - factorOf(a.analysis, "F2");
      if (g) return g;
      const c = factorOf(b.analysis, "F6") - factorOf(a.analysis, "F6");
      if (c) return c;
      const s = factorOf(b.analysis, "F7") - factorOf(a.analysis, "F7");
      if (s) return s;
      return factorOf(b.analysis, "F8") - factorOf(a.analysis, "F8");
    })
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return rows;
}

export function dashboardStats(companies: Company[], analyses: Analysis[]) {
  const latest = companies
    .map((c) => latestAnalysis(analyses, c.id))
    .filter((a): a is Analysis => Boolean(a));
  const aCount = latest.filter((a) => a.grade === "S" || a.grade === "A").length;
  const bCount = latest.filter((a) => a.grade === "B").length;
  const refresh = companies.filter((c) => needsRefresh(latestAnalysis(analyses, c.id))).length;
  const cutoff = Date.now() - 14 * 86400000;
  const newEvidence = analyses.reduce((n, a) => {
    return n + a.evidences.filter((e) => new Date(e.createdAt).getTime() >= cutoff).length;
  }, 0);
  return { aCount, bCount, refresh, newEvidence, total: latest.length };
}

export function gradeTone(grade: string): "a" | "b" | "c" | "d" {
  if (grade === "S" || grade === "A") return "a";
  if (grade === "B") return "b";
  if (grade === "C") return "c";
  return "d";
}

export { GRADE_THRESHOLDS };
