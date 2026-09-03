import { clamp } from "../utils.ts";
import {
  FACTOR_MAX,
  FACTOR_WEIGHT,
  GRADE_THRESHOLDS,
  HARD_GATE,
  RAW_SCORE_MAX,
  VERDICT_BY_GRADE,
  snapEvenScore,
  weightedFactorScore,
  type Confidence,
  type FlagStatus,
  type Grade,
  type Verdict,
} from "./config.ts";
import type { FactorScore, HardGates, RedFlag } from "../types.ts";


export function effectiveFactorScore(fs: FactorScore): number | null {
  const raw = fs.overrideScore ?? fs.score;
  return snapEvenScore(raw);
}

export function factorTotal(scores: FactorScore[]): number {
  return scores.reduce((sum, fs) => sum + (effectiveFactorScore(fs) ?? 0), 0);
}

export function weightedTotal(scores: FactorScore[]): number {
  return scores.reduce((sum, fs) => {
    const raw = effectiveFactorScore(fs);
    const w = fs.weight || FACTOR_WEIGHT[fs.factorCode];
    const part = weightedFactorScore(raw, w);
    return sum + (part ?? 0);
  }, 0);
}

export function rawWildcardScore(total: number): number {
  return clamp(total, 0, RAW_SCORE_MAX);
}

export function isHardStop(flags: RedFlag[]): boolean {
  return flags.some(
    (f) =>
      f.hardStop ||
      (f.status === "RED" && (f.flagType === "SURVIVAL" || f.flagType === "TENX")),
  );
}

export function penaltyPoints(flags: RedFlag[]): { points: number; hardStop: boolean } {
  let points = 0;
  let hardStop = false;
  for (const flag of flags) {
    if (flag.hardStop) hardStop = true;
    points += flag.penalty;
  }
  return { points, hardStop };
}

export function adjustedWildcardScore(raw: number, flags: RedFlag[]): {
  score: number;
  hardStop: boolean;
} {
  const { hardStop } = penaltyPoints(flags);
  return { score: clamp(raw, 0, RAW_SCORE_MAX), hardStop };
}

export function gradeFromScore(adjusted: number, hardStop: boolean): Grade {
  if (hardStop) return "F";
  if (adjusted >= GRADE_THRESHOLDS.S) return "S";
  if (adjusted >= GRADE_THRESHOLDS.A) return "A";
  if (adjusted >= GRADE_THRESHOLDS.B) return "B";
  if (adjusted >= GRADE_THRESHOLDS.C) return "C";
  if (adjusted >= GRADE_THRESHOLDS.D) return "D";
  return "F";
}

export function verdictFromGrade(grade: Grade): Verdict {
  return VERDICT_BY_GRADE[grade];
}

export function flagPenalty(type: "management" | "survival" | "tenx", status: FlagStatus): {
  penalty: number;
  hardStop: boolean;
} {
  if (status === "RED" && (type === "survival" || type === "tenx")) {
    return { penalty: 0, hardStop: true };
  }
  return { penalty: 0, hardStop: false };
}

function scoreOf(scores: FactorScore[], code: FactorScore["factorCode"]): number | null {
  const fs = scores.find((s) => s.factorCode === code);
  return fs ? effectiveFactorScore(fs) : null;
}

export function evaluateHardGates(scores: FactorScore[]): HardGates {
  const f10 = scoreOf(scores, "F10");
  const f7 = scoreOf(scores, "F7");
  const f6 = scoreOf(scores, "F6");
  const f1 = scoreOf(scores, "F1");
  return {
    tenx: f10 == null ? "RESEARCH REQUIRED" : f10 < HARD_GATE.tenxMin ? "FAIL" : "PASS",
    survival: f7 == null ? "RESEARCH REQUIRED" : f7 < HARD_GATE.survivalMin ? "FAIL" : "PASS",
    customer: f6 == null ? "RESEARCH REQUIRED" : f6 < HARD_GATE.customerMin ? "WATCHLIST" : "PASS",
    evidence:
      f10 == null || f7 == null || f6 == null || f1 == null
        ? "RESEARCH REQUIRED"
        : "PASS",
  };
}

export function overallConfidence(scores: FactorScore[]): Confidence {
  const high = scores.filter((s) => s.confidence === "High").length;
  const mid = scores.filter((s) => s.confidence === "High" || s.confidence === "Medium").length;
  if (high >= 7) return "High";
  if (mid >= 7) return "Medium";
  return "Low";
}

export function scoreAnalysis(scores: FactorScore[], flags: RedFlag[]) {
  const total = factorTotal(scores);
  const weighted = weightedTotal(scores);
  const raw = rawWildcardScore(weighted);
  const gates = evaluateHardGates(scores);
  const gateFail = gates.tenx === "FAIL" || gates.survival === "FAIL";
  const { hardStop: flagStop } = adjustedWildcardScore(raw, flags);
  const hardStop = gateFail || flagStop;
  let grade = gradeFromScore(raw, hardStop);
  let verdict = verdictFromGrade(grade);
  if (gateFail) {
    grade = "F";
    verdict = "Reject";
  } else if (gates.customer === "WATCHLIST" && (grade === "S" || grade === "A")) {
    verdict = "Watchlist";
  }
  return {
    factorTotal: total,
    rawScore: raw,
    adjustedScore: raw,
    grade,
    verdict,
    hardStop,
    hardGates: gates,
    overallConfidence: overallConfidence(scores),
  };
}

export function decorateFactor(fs: FactorScore): FactorScore {
  const score = effectiveFactorScore(fs);
  const weight = fs.weight || FACTOR_WEIGHT[fs.factorCode];
  return {
    ...fs,
    score: fs.score == null && fs.overrideScore == null ? null : (fs.score ?? score),
    weight,
    weightedScore: weightedFactorScore(score, weight),
  };
}
