export const COVERAGE_RULE = {
  noPenalty: 0.9,
  mild: 0.8,
  research: 0.7,
  mildPenalty: 3,
  heavyPenalty: 7,
} as const;

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

export function coveragePenalty(coverage: number): { penalty: number; researchRequired: boolean } {
  if (coverage < COVERAGE_RULE.research) return { penalty: 0, researchRequired: true };
  if (coverage < COVERAGE_RULE.mild) return { penalty: COVERAGE_RULE.heavyPenalty, researchRequired: false };
  if (coverage < COVERAGE_RULE.noPenalty) return { penalty: COVERAGE_RULE.mildPenalty, researchRequired: false };
  return { penalty: 0, researchRequired: false };
}

export function applyCoverage(normalized: number, coverage: number): {
  adjusted: number;
  penalty: number;
  status: "COMPLETE" | "PARTIAL" | "RESEARCH REQUIRED";
} {
  const { penalty, researchRequired } = coveragePenalty(coverage);
  if (researchRequired) {
    return { adjusted: normalized, penalty: 0, status: "RESEARCH REQUIRED" };
  }
  const adjusted = Math.max(0, normalized - penalty);
  const status = coverage >= COVERAGE_RULE.noPenalty ? "COMPLETE" : "PARTIAL";
  return { adjusted, penalty, status };
}
