import {
  FACTOR_META,
  FACTOR_ORDER,
  GRADE_THRESHOLDS,
  HARD_GATE,
  VERDICT_BY_GRADE,
  type FactorCode,
  type Grade,
  type TenxFeasibility,
  type Verdict,
} from "../scoring/config.ts";
import { applyCoverage, weightedObserved } from "./coverage.ts";
import type { TenxMath, TenxScenario } from "../types.ts";

export const XBG_VERSION = "XBG-v2.0";

export const X_IDS: Record<FactorCode, string> = {
  F1: "X01",
  F2: "X02",
  F3: "X03",
  F4: "X04",
  F5: "X05",
  F6: "X06",
  F7: "X07",
  F8: "X08",
  F9: "X09",
  F10: "X10",
};

export interface XFactor {
  id: string;
  code: FactorCode;
  name: string;
  score: number | null;
  weight: number;
  weightedScore: number | null;
  coverage: number;
  confidence: "High" | "Medium" | "Low";
  reason: string;
  calculation: string;
  evidenceIds: string[];
  status: "SCORED" | "NA" | "OVERRIDE";
}

export interface XGates {
  trust: "PASS" | "FAIL" | "RESEARCH REQUIRED";
  survival: "PASS" | "FAIL" | "RESEARCH REQUIRED";
  tenx: "PASS" | "FAIL" | "RESEARCH REQUIRED";
  customer: "PASS" | "FAIL" | "WATCHLIST" | "RESEARCH REQUIRED";
}

export interface XBaggerResult {
  version: typeof XBG_VERSION;
  observedWeighted: number;
  availableWeight: number;
  normalizedScore: number;
  coverage: number;
  coveragePenalty: number;
  adjustedScore: number;
  grade: Grade;
  verdict: Verdict;
  factors: XFactor[];
  gates: XGates;
  tenxMath: TenxMath | null;
  tenxScenarios: TenxScenario[];
  tenxFeasibility: TenxFeasibility;
  status: "COMPLETE" | "PARTIAL" | "RESEARCH REQUIRED";
}

function gradeOf(score: number): Grade {
  if (score >= GRADE_THRESHOLDS.S) return "S";
  if (score >= GRADE_THRESHOLDS.A) return "A";
  if (score >= GRADE_THRESHOLDS.B) return "B";
  if (score >= GRADE_THRESHOLDS.C) return "C";
  if (score >= GRADE_THRESHOLDS.D) return "D";
  return "F";
}

export function scoreXBagger(input: {
  factors: Array<{
    code: FactorCode;
    score: number | null;
    reason: string;
    confidence?: "High" | "Medium" | "Low";
    evidenceIds?: string[];
    override?: boolean;
  }>;
  tenxMath: TenxMath | null;
  tenxScenarios: TenxScenario[];
  tenxFeasibility: TenxFeasibility;
  trustFail?: boolean;
}): XBaggerResult {
  const byCode = new Map(input.factors.map((f) => [f.code, f]));
  const factors: XFactor[] = FACTOR_ORDER.map((code) => {
    const row = byCode.get(code);
    const weight = FACTOR_META[code].weight;
    const score = row?.score ?? null;
    return {
      id: X_IDS[code],
      code,
      name: FACTOR_META[code].name,
      score,
      weight,
      weightedScore: score == null ? null : (score / 10) * weight,
      coverage: score == null ? 0 : 1,
      confidence: row?.confidence ?? (score == null ? "Low" : "Medium"),
      reason: row?.reason ?? "자료 없음. N/A.",
      calculation: score == null ? "NA" : `${score}/10 × ${weight}`,
      evidenceIds: row?.evidenceIds ?? [],
      status: row?.override ? "OVERRIDE" : score == null ? "NA" : "SCORED",
    };
  });

  const w = weightedObserved(factors);
  const cov = applyCoverage(w.normalized, w.coverage);
  let grade = gradeOf(cov.adjusted);
  let verdict = VERDICT_BY_GRADE[grade];

  const f6 = factors.find((f) => f.code === "F6")?.score ?? null;
  const f7 = factors.find((f) => f.code === "F7")?.score ?? null;
  const f10 = factors.find((f) => f.code === "F10")?.score ?? null;

  const gates: XGates = {
    trust: input.trustFail ? "FAIL" : "PASS",
    survival: f7 == null ? "RESEARCH REQUIRED" : f7 < HARD_GATE.survivalMin ? "FAIL" : "PASS",
    tenx: f10 == null ? "RESEARCH REQUIRED" : f10 < HARD_GATE.tenxMin ? "FAIL" : "PASS",
    customer: f6 == null ? "RESEARCH REQUIRED" : f6 < HARD_GATE.customerMin ? "WATCHLIST" : "PASS",
  };

  if (gates.trust === "FAIL" || gates.survival === "FAIL" || gates.tenx === "FAIL") {
    grade = "F";
    verdict = "Reject";
  } else if (cov.status === "RESEARCH REQUIRED") {
    verdict = "Low Conviction";
  }

  return {
    version: XBG_VERSION,
    observedWeighted: w.observed,
    availableWeight: w.available,
    normalizedScore: w.normalized,
    coverage: w.coverage,
    coveragePenalty: cov.penalty,
    adjustedScore: cov.adjusted,
    grade,
    verdict,
    factors,
    gates,
    tenxMath: input.tenxMath,
    tenxScenarios: input.tenxScenarios,
    tenxFeasibility: input.tenxFeasibility,
    status: cov.status,
  };
}
