export const SCORING_VERSION = "TenbaggerLite-v1.0";

export const FACTOR_MIN = 0;
export const FACTOR_MAX = 2;
export const FACTOR_COUNT = 10;
export const FACTOR_TOTAL_MAX = FACTOR_MAX * FACTOR_COUNT;
export const RAW_SCORE_MULTIPLIER = 5;
export const RAW_SCORE_MAX = 100;

export const GRADE_THRESHOLDS = {
  A: 85,
  B: 70,
  C: 55,
} as const;

export const PENALTY = {
  management: { GREEN: 0, YELLOW: 5, RED: 15 },
  survival: { GREEN: 0, YELLOW: 10, RED: "HARD_STOP" },
  tenx: { GREEN: 0, YELLOW: 10, RED: "HARD_STOP" },
} as const;

export type FlagStatus = "GREEN" | "YELLOW" | "RED";
export type Grade = "A" | "B" | "C" | "D";
export type Verdict =
  | "DEEP DIVE NOW"
  | "WATCH"
  | "WAIT FOR PROOF"
  | "PASS";
export type TenxFeasibility = "HIGH" | "POSSIBLE" | "LOW" | "UNREALISTIC";
export type HandoffStatus = "NOT SENT" | "READY" | "IN REVIEW" | "MASTER COMPLETE";
export type EvidenceType = "FACT" | "REPORTED" | "MANAGEMENT_TARGET" | "INFERENCE";
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

export const FACTOR_META: Record<
  FactorCode,
  { name: string; nameKo: string; question: string }
> = {
  F1: {
    name: "Market Growth",
    nameKo: "시장 성장",
    question: "실제 돈을 벌 수 있는 시장이 향후 5~10년간 구조적으로 성장하는가?",
  },
  F2: {
    name: "Revenue Growth",
    nameKo: "매출 성장",
    question: "매출 성장이 높고 가속되는가, 선행지표가 강한가?",
  },
  F3: {
    name: "Scalability",
    nameKo: "확장성",
    question: "Operating leverage, 반복매출, 낮은 한계자본 요구가 있는가?",
  },
  F4: {
    name: "Technology / Moat",
    nameKo: "기술·해자",
    question: "특허, qualification barrier, switching cost, 선도 기술이 있는가?",
  },
  F5: {
    name: "Market Position",
    nameKo: "시장 지위",
    question: "Niche leader, bottleneck supplier, 점유율 상승 중인가?",
  },
  F6: {
    name: "Customer Validation",
    nameKo: "고객 검증",
    question: "Qualification, 양산, PO, Repeat PO, 대형 고객이 확인되는가?",
  },
  F7: {
    name: "Financial Survival",
    nameKo: "재무 생존",
    question: "Cash, 부채, CFO, 24개월+ runway, 희석 위험이 낮은가?",
  },
  F8: {
    name: "Valuation Room",
    nameKo: "밸류에이션 여력",
    question: "미래 기회 대비 현재 시총이 충분히 작은가?",
  },
  F9: {
    name: "Catalyst",
    nameKo: "촉매",
    question: "향후 6~24개월 시장 인식을 바꿀 사건이 있는가?",
  },
  F10: {
    name: "10x Math",
    nameKo: "10배 수학",
    question: "보수적~중립 가정으로 현재 시총의 10배가 설명 가능한가?",
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
  A: "DEEP DIVE NOW",
  B: "WATCH",
  C: "WAIT FOR PROOF",
  D: "PASS",
};

export const GRADE_LABEL_KO: Record<Grade, string> = {
  A: "지금 깊게 볼 것",
  B: "관찰",
  C: "증거 대기",
  D: "패스",
};
