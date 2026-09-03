import { clamp } from "../utils.ts";
import {
  GRADE_THRESHOLDS,
  PENALTY,
  RAW_SCORE_MAX,
  RAW_SCORE_MULTIPLIER,
  VERDICT_BY_GRADE,
  type FlagStatus,
  type Grade,
  type Verdict,
} from "./config.ts";
import type { FactorScore, RedFlag } from "../types.ts";


export function effectiveFactorScore(fs: FactorScore): number {
  return fs.overrideScore ?? fs.score;
}

export function factorTotal(scores: FactorScore[]): number {
  return scores.reduce((sum, fs) => sum + effectiveFactorScore(fs), 0);
}

export function rawWildcardScore(total: number): number {
  return clamp(total * RAW_SCORE_MULTIPLIER, 0, RAW_SCORE_MAX);
}

export function isHardStop(flags: RedFlag[]): boolean {
  return flags.some((f) => f.hardStop || f.status === "RED" && (f.flagType === "SURVIVAL" || f.flagType === "TENX"));
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
  const { points, hardStop } = penaltyPoints(flags);
  if (hardStop) {
    return { score: clamp(raw - points, 0, RAW_SCORE_MAX), hardStop: true };
  }
  return { score: clamp(raw - points, 0, RAW_SCORE_MAX), hardStop: false };
}

export function gradeFromScore(adjusted: number, hardStop: boolean): Grade {
  if (hardStop) return "D";
  if (adjusted >= GRADE_THRESHOLDS.A) return "A";
  if (adjusted >= GRADE_THRESHOLDS.B) return "B";
  if (adjusted >= GRADE_THRESHOLDS.C) return "C";
  return "D";
}

export function verdictFromGrade(grade: Grade): Verdict {
  return VERDICT_BY_GRADE[grade];
}

export function flagPenalty(type: "management" | "survival" | "tenx", status: FlagStatus): {
  penalty: number;
  hardStop: boolean;
} {
  const rule = PENALTY[type][status];
  if (rule === "HARD_STOP") return { penalty: 0, hardStop: true };
  return { penalty: rule, hardStop: false };
}

export function scoreAnalysis(scores: FactorScore[], flags: RedFlag[]) {
  const total = factorTotal(scores);
  const raw = rawWildcardScore(total);
  const { score, hardStop } = adjustedWildcardScore(raw, flags);
  const grade = gradeFromScore(score, hardStop);
  return {
    factorTotal: total,
    rawScore: raw,
    adjustedScore: score,
    hardStop,
    grade,
    verdict: verdictFromGrade(grade),
  };
}
