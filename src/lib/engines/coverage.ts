export const COVERAGE_RULE = {
  noPenalty: 0.9,
  mild: 0.8,
  research: 0.7,
  mildPenalty: 3,
  heavyPenalty: 7,
} as const;

export type CoverageRule = {
  noPenalty: number;
  mild: number;
  research: number;
  mildPenalty: number;
  heavyPenalty: number;
};

export function weightedObserved(items: Array<{ score: number | null; weight: number }>): {
  observed: number;
  available: number;
  totalWeight: number;
  normalized: number;
  coverage: number;
} {
  let observed = 0;
  let available = 0;
  let totalWeight = 0;
  for (const item of items) {
    totalWeight += item.weight;
    if (item.score != null && Number.isFinite(item.score)) {
      available += item.weight;
      observed += (item.score / 10) * item.weight;
    }
  }
  const coverage = totalWeight > 0 ? available / totalWeight : 0;
  const normalized = available > 0 ? (observed / available) * 100 : 0;
  return { observed, available, totalWeight, normalized, coverage };
}

export function coveragePenalty(
  coverage: number,
  rule: CoverageRule = COVERAGE_RULE,
): { penalty: number; researchRequired: boolean } {
  if (coverage < rule.research) return { penalty: 0, researchRequired: true };
  if (coverage < rule.mild) return { penalty: rule.heavyPenalty, researchRequired: false };
  if (coverage < rule.noPenalty) return { penalty: rule.mildPenalty, researchRequired: false };
  return { penalty: 0, researchRequired: false };
}

export function applyCoverage(
  normalized: number,
  coverage: number,
  rule: CoverageRule = COVERAGE_RULE,
): {
  adjusted: number;
  penalty: number;
  status: "COMPLETE" | "PARTIAL" | "RESEARCH REQUIRED";
} {
  const { penalty, researchRequired } = coveragePenalty(coverage, rule);
  if (researchRequired) {
    return { adjusted: normalized, penalty: 0, status: "RESEARCH REQUIRED" };
  }
  const adjusted = Math.max(0, normalized - penalty);
  const status = coverage >= rule.noPenalty ? "COMPLETE" : "PARTIAL";
  return { adjusted, penalty, status };
}
