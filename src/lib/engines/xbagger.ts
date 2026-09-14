import {
  FACTOR_META,
  FACTOR_ORDER,
  VERDICT_BY_GRADE,
  type FactorCode,
  type Grade,
  type TenxFeasibility,
  type Verdict,
} from "../scoring/config.ts";
import { applyCoverage, weightedObserved } from "./coverage.ts";
import { getCriteria } from "./criteria/active.ts";
import type { XBaggerCriteria } from "./criteria/types.ts";
import { f10FromMath } from "../tenx/calculator.ts";
import type { TenxMath, TenxScenario } from "../types.ts";

export const XBG_VERSION = "XBG-v2.1";

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

export interface TrustSignals {
  management?: boolean;
  disclosure?: boolean;
  auditGoingConcern?: boolean;
}

export interface SurvivalEvidence {
  fcf?: number | null;
  cfo?: number | null;
  cash?: number | null;
  debt?: number | null;
  runwayYears?: number | null;
}

export interface CustomerEvidence {
  named?: boolean;
  paid?: boolean;
  repeat?: boolean;
  retention?: boolean;
  model?: "b2b" | "b2c" | "unknown";
}

export interface XGates {
  trust: "PASS" | "FAIL" | "RESEARCH REQUIRED";
  survival: "PASS" | "FAIL" | "RESEARCH REQUIRED";
  tenx: "PASS" | "FAIL" | "RESEARCH REQUIRED";
  customer: "PASS" | "FAIL" | "WATCHLIST" | "RESEARCH REQUIRED";
}

export interface XBaggerResult {
  version: string;
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
  f10MathComplete: boolean;
  trustSignals: TrustSignals;
  status: "COMPLETE" | "PARTIAL" | "RESEARCH REQUIRED";
}

export interface XBaggerInput {
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
  trustSignals?: TrustSignals;
  survivalEvidence?: SurvivalEvidence;
  customerEvidence?: CustomerEvidence;
}

function gradeOf(score: number, t: XBaggerCriteria["gradeThresholds"]): Grade {
  if (score >= t.S) return "S";
  if (score >= t.A) return "A";
  if (score >= t.B) return "B";
  if (score >= t.C) return "C";
  if (score >= t.D) return "D";
  return "F";
}

function survivalGate(
  f7: number | null,
  ev: SurvivalEvidence | undefined,
  min: number,
): XGates["survival"] {
  const cash = ev?.cash ?? null;
  const fcf = ev?.fcf ?? null;
  const cfo = ev?.cfo ?? null;
  const runway = ev?.runwayYears ?? null;
  const netCash = cash != null && ev?.debt != null ? cash >= ev.debt : cash != null && cash > 0 && (ev?.debt ?? 0) === 0;
  const cashflowOk = (fcf != null && fcf > 0) || (cfo != null && cfo > 0);
  const distress =
    (runway != null && runway < 1) ||
    (fcf != null && fcf < 0 && cash != null && cash <= 0) ||
    (f7 != null && f7 <= 0);
  if (distress) return "FAIL";
  const complete = cashflowOk && (netCash || (runway != null && runway >= 2) || (f7 != null && f7 >= min));
  if (complete && (f7 == null || f7 >= min)) return "PASS";
  if (f7 == null || !cashflowOk) return "RESEARCH REQUIRED";
  if (f7 < min) return "FAIL";
  return "RESEARCH REQUIRED";
}

function customerGate(
  f6: number | null,
  ev: CustomerEvidence | undefined,
  min: number,
): XGates["customer"] {
  const named = Boolean(ev?.named);
  const paid = Boolean(ev?.paid);
  const repeat = Boolean(ev?.repeat);
  const retention = Boolean(ev?.retention);
  const validated = named || paid || repeat || retention;
  if (!validated) {
    if (f6 == null) return "RESEARCH REQUIRED";
    return "WATCHLIST";
  }
  if (f6 == null) return "RESEARCH REQUIRED";
  if (f6 < min) return "WATCHLIST";
  return "PASS";
}

export function scoreXBagger(input: XBaggerInput, criteria?: XBaggerCriteria): XBaggerResult {
  const spec = criteria ?? getCriteria().engines.xbagger;
  const mathOk = Boolean(input.tenxMath && input.tenxMath.currentRevenue != null && input.tenxScenarios.length > 0);
  const mathF10 = f10FromMath(mathOk ? input.tenxMath : null, input.tenxScenarios);
  const byCode = new Map(input.factors.map((f) => [f.code, f]));
  const factors: XFactor[] = FACTOR_ORDER.map((code) => {
    const row = byCode.get(code);
    const weight = spec.weights[code];
    let score = row?.score ?? null;
    let reason = row?.reason ?? "자료 없음. N/A.";
    if (code === "F10" && !row?.override) {
      score = mathF10.score;
      reason = mathF10.reason;
    }
    return {
      id: X_IDS[code],
      code,
      name: FACTOR_META[code].name,
      score,
      weight,
      weightedScore: score == null ? null : (score / 10) * weight,
      coverage: score == null ? 0 : 1,
      confidence: row?.confidence ?? (score == null ? "Low" : "Medium"),
      reason,
      calculation: score == null ? "NA" : `${score}/10 × ${weight}`,
      evidenceIds: row?.evidenceIds ?? [],
      status: row?.override && score != null ? "OVERRIDE" : score == null ? "NA" : "SCORED",
    };
  });

  const w = weightedObserved(factors);
  const cov = applyCoverage(w.normalized, w.coverage, spec.coverage);
  let grade = gradeOf(cov.adjusted, spec.gradeThresholds);
  let verdict = VERDICT_BY_GRADE[grade];

  const f6 = factors.find((f) => f.code === "F6")?.score ?? null;
  const f7 = factors.find((f) => f.code === "F7")?.score ?? null;
  const f10 = factors.find((f) => f.code === "F10")?.score ?? null;
  const trustSignals: TrustSignals = {
    management: input.trustFail ? true : input.trustSignals?.management,
    disclosure: input.trustSignals?.disclosure,
    auditGoingConcern: input.trustSignals?.auditGoingConcern,
  };

  const gates: XGates = {
    trust: input.trustFail || trustSignals.auditGoingConcern ? "FAIL" : "PASS",
    survival: survivalGate(f7, input.survivalEvidence, spec.hardGates.survivalMin),
    tenx: !mathOk || f10 == null ? "RESEARCH REQUIRED" : f10 < spec.hardGates.tenxMin ? "FAIL" : "PASS",
    customer: customerGate(f6, input.customerEvidence, spec.hardGates.customerMin),
  };

  if (gates.trust === "FAIL" || gates.survival === "FAIL" || gates.tenx === "FAIL") {
    grade = "F";
    verdict = "Reject";
  } else if (cov.status === "RESEARCH REQUIRED") {
    verdict = "Low Conviction";
  }

  return {
    version: spec.version,
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
    f10MathComplete: mathOk,
    trustSignals,
    status: cov.status,
  };
}
