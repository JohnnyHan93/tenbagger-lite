export const SCORING_VERSION = "TenbaggerWildcard-v1.0";

export const FACTOR_MIN = 0;
export const FACTOR_MAX = 10;
export const FACTOR_STEP = 2;
export const FACTOR_LADDER = [0, 2, 4, 6, 8, 10] as const;
export const FACTOR_COUNT = 10;
export const RAW_SCORE_MAX = 100;

export const GRADE_THRESHOLDS = {
  S: 85,
  A: 75,
  B: 65,
  C: 55,
  D: 45,
} as const;

export const HARD_GATE = {
  tenxMin: 6,
  survivalMin: 4,
  customerMin: 4,
} as const;

export type FlagStatus = "GREEN" | "YELLOW" | "RED";
export type Grade = "S" | "A" | "B" | "C" | "D" | "F";
export type Verdict =
  | "Prime Wildcard"
  | "Candidate"
  | "Watchlist"
  | "Speculative"
  | "Low Conviction"
  | "Reject";
export type TenxFeasibility = "HIGH" | "POSSIBLE" | "LOW" | "UNREALISTIC";
export type TenxPath = "Plausible" | "Borderline" | "Implausible";
export type HandoffStatus = "NOT SENT" | "READY" | "IN REVIEW" | "MASTER COMPLETE";
export type EvidenceType = "FACT" | "REPORTED" | "MANAGEMENT_TARGET" | "INFERENCE";
export type Confidence = "High" | "Medium" | "Low";
export type GateResult = "PASS" | "FAIL" | "WATCHLIST" | "RESEARCH REQUIRED";
export type FactorCode =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10";
export type FlagType = "MANAGEMENT" | "SURVIVAL" | "TENX";

export const FACTOR_WEIGHT: Record<FactorCode, number> = {
  F1: 12,
  F2: 12,
  F3: 10,
  F4: 10,
  F5: 10,
  F6: 10,
  F7: 12,
  F8: 8,
  F9: 6,
  F10: 10,
};

export const FACTOR_META: Record<
  FactorCode,
  { name: string; nameKo: string; question: string; weight: number }
> = {
  F1: {
    name: "Market Growth / TAM",
    nameKo: "시장 성장·TAM",
    question: "핵심 시장이 충분히 크고 빠르며, 현재 매출 대비 장기 확장 공간이 큰가?",
    weight: 12,
  },
  F2: {
    name: "Revenue Growth",
    nameKo: "매출 성장",
    question: "매출이 실제로 빠르게 성장하고, 유지 또는 가속되는가?",
    weight: 12,
  },
  F3: {
    name: "Scalability",
    nameKo: "확장성",
    question: "매출이 5배가 될 때 비용·자본도 5배인가, 아니면 이익률이 개선되는가?",
    weight: 10,
  },
  F4: {
    name: "Technology / Moat",
    nameKo: "기술·해자",
    question: "경쟁사가 쉽게 복제할 수 없는 기술적·경제적 방어력이 있는가?",
    weight: 10,
  },
  F5: {
    name: "Market Position",
    nameKo: "시장 지위",
    question: "커지는 시장에서 이 회사가 실제 승자가 될 위치에 있는가?",
    weight: 10,
  },
  F6: {
    name: "Customer Validation",
    nameKo: "고객 검증",
    question: "실제 고객이 돈을 지불하고 반복 구매·확장이 확인되는가?",
    weight: 10,
  },
  F7: {
    name: "Financial Survival",
    nameKo: "재무 생존",
    question: "3~7년을 파산이나 대규모 희석 없이 버틸 수 있는가?",
    weight: 12,
  },
  F8: {
    name: "Valuation Room",
    nameKo: "밸류에이션 여력",
    question: "훌륭한 미래가 이미 현재 주가에 대부분 반영되어 있지는 않은가?",
    weight: 8,
  },
  F9: {
    name: "Catalyst",
    nameKo: "촉매",
    question: "향후 12~36개월 내 가치를 재평가하게 만들 구체적 사건이 있는가?",
    weight: 6,
  },
  F10: {
    name: "10x Math",
    nameKo: "10배 수학",
    question: "현재 시가총액의 10배가 되는 경로를 합리적인 숫자로 설명할 수 있는가?",
    weight: 10,
  },
};

export const FACTOR_ORDER: FactorCode[] = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
];

export const VERDICT_BY_GRADE: Record<Grade, Verdict> = {
  S: "Prime Wildcard",
  A: "Candidate",
  B: "Watchlist",
  C: "Speculative",
  D: "Low Conviction",
  F: "Reject",
};

export const GRADE_LABEL_KO: Record<Grade, string> = {
  S: "최우선 Deep Research",
  A: "고확신 후보",
  B: "강한 관찰",
  C: "투기·추가 검증",
  D: "낮은 확신",
  F: "기각",
};

export function snapEvenScore(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const clamped = Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, n));
  return Math.round(clamped / FACTOR_STEP) * FACTOR_STEP;
}

export function weightedFactorScore(raw: number | null, weight: number): number | null {
  if (raw == null) return null;
  return (raw / FACTOR_MAX) * weight;
}
