import type { DerivedMetrics } from "../metrics/derived.ts";

export const OSM_VERSION = "OSM-v1.0";

export type OversoldCase = "A" | "B" | "C" | "D";

export interface OversoldResult {
  version: typeof OSM_VERSION;
  fundamental: number | null;
  valuation: number | null;
  oversold: number | null;
  riskInverse: number | null;
  opportunity: number | null;
  valueTrap: number;
  case: OversoldCase;
  peakEarnings: boolean;
  coverage: number;
  confidence: "High" | "Medium" | "Low";
  reasons: {
    fundamental: string;
    valuation: string;
    oversold: string;
    risk: string;
    trap: string;
  };
  status: "COMPLETE" | "PARTIAL" | "RESEARCH REQUIRED";
}

const W = { F: 0.4, V: 0.25, O: 0.1, R: 0.25 } as const;

export function opportunityScore(f: number, v: number, o: number, r: number): number {
  return f * W.F + v * W.V + o * W.O + r * W.R;
}

function clamp10(n: number): number {
  return Math.min(10, Math.max(0, n));
}

function fundScore(m: DerivedMetrics): { score: number | null; reason: string } {
  if (m.revenueYoY == null && m.om == null && m.niTtm == null) {
    return { score: null, reason: "매출·이익 시계열 없음. N/A." };
  }
  let s = 5;
  const bits: string[] = [];
  if (m.revenueYoY != null) {
    if (m.revenueYoY > 0.15) {
      s += 2;
      bits.push(`매출 +${(m.revenueYoY * 100).toFixed(0)}%`);
    } else if (m.revenueYoY > 0) {
      s += 1;
      bits.push(`매출 +${(m.revenueYoY * 100).toFixed(0)}%`);
    } else if (m.revenueYoY > -0.08) {
      s -= 1;
      bits.push(`매출 소폭 감소`);
    } else {
      s -= 3;
      bits.push(`매출 ${(m.revenueYoY * 100).toFixed(0)}%`);
    }
  }
  if (m.om != null) {
    if (m.om > 0.15) s += 1;
    else if (m.om < 0) s -= 2;
    bits.push(`OM ${(m.om * 100).toFixed(0)}%`);
  }
  if (m.omChange != null) {
    if (m.omChange > 0.02) s += 1;
    else if (m.omChange < -0.05) s -= 2;
  }
  return { score: clamp10(s), reason: bits.join(" · ") || "부분 펀더멘털" };
}

function valScore(m: DerivedMetrics): { score: number | null; reason: string; peak: boolean } {
  const peak = Boolean(
    m.om != null &&
      m.om > 0.25 &&
      m.revenueYoY != null &&
      m.revenueYoY < 0 &&
      (m.pe != null && m.pe < 8),
  );
  if (m.evSales == null && m.pe == null && m.pb == null) {
    return { score: null, reason: "밸류에이션 배수 없음. N/A.", peak };
  }
  let s = 5;
  const bits: string[] = [];
  if (m.evSales != null) {
    bits.push(`EV/S ${m.evSales.toFixed(1)}x`);
    if (m.evSales < 2) s += 3;
    else if (m.evSales < 4) s += 2;
    else if (m.evSales < 8) s += 0;
    else if (m.evSales < 15) s -= 2;
    else s -= 3;
  }
  if (m.pe != null) {
    bits.push(`P/E ${m.pe.toFixed(1)}x`);
    if (m.pe < 12) s += 2;
    else if (m.pe > 40) s -= 2;
  }
  if (peak) {
    s -= 2;
    bits.push("Peak earnings 의심 — 저배수 ≠ 저평가");
  }
  return { score: clamp10(s), reason: bits.join(" · "), peak };
}

function oversoldPx(m: DerivedMetrics): { score: number | null; reason: string } {
  if (m.drawdown52w == null && m.return3m == null && m.return6m == null) {
    return { score: null, reason: "52주 고점·수익률 없음. N/A." };
  }
  const dd = m.drawdown52w;
  if (dd == null) {
    const r = m.return6m ?? m.return3m ?? 0;
    if (r >= 0) return { score: 1, reason: "최근 수익률 음수 아님 — 과매도 명제 약함" };
    const s = r < -0.35 ? 8 : r < -0.2 ? 6 : 4;
    return { score: s, reason: `최근 수익률 ${(r * 100).toFixed(0)}%` };
  }
  if (dd <= 0.05) return { score: 1, reason: "52주 고점 근처 — Case D 후보" };
  if (dd < 0.15) return { score: 3, reason: `낙폭 ${(dd * 100).toFixed(0)}%` };
  if (dd < 0.3) return { score: 5, reason: `낙폭 ${(dd * 100).toFixed(0)}%` };
  if (dd < 0.5) return { score: 7, reason: `낙폭 ${(dd * 100).toFixed(0)}%` };
  return { score: 9, reason: `낙폭 ${(dd * 100).toFixed(0)}% — 가격만으로 결론 금지` };
}

function riskInv(m: DerivedMetrics): { score: number | null; reason: string } {
  let s = 5;
  const bits: string[] = [];
  if (m.netDebt != null && m.cash != null) {
    if (m.netDebt < 0) {
      s += 2;
      bits.push("순현금");
    } else if (m.netDebtEbitda != null && m.netDebtEbitda > 3) {
      s -= 3;
      bits.push(`Net debt/EBITDA ${m.netDebtEbitda.toFixed(1)}x`);
    } else {
      bits.push("순부채 존재");
    }
  } else {
    bits.push("부채 커버리지 불명");
  }
  if (m.shareGrowth != null) {
    if (m.shareGrowth > 0.15) {
      s -= 2;
      bits.push(`희석 ${(m.shareGrowth * 100).toFixed(0)}%`);
    } else if (m.shareGrowth < 0) {
      s += 1;
      bits.push("자사주/감소");
    }
  }
  if (m.customerConcentration != null && m.customerConcentration > 0.4) {
    s -= 1;
    bits.push("고객 집중");
  }
  if (m.fcf != null && m.fcf < 0) {
    s -= 1;
    bits.push("FCF 적자");
  }
  return { score: clamp10(s), reason: bits.join(" · ") || "리스크 부분 평가" };
}

function trapScore(m: DerivedMetrics, fund: number | null): { score: number; reason: string } {
  let hits = 1;
  const bits: string[] = [];
  if (m.revenueYoY != null && m.revenueYoY < -0.1) {
    hits += 2;
    bits.push("구조적 매출 감소 가능");
  }
  if (m.omChange != null && m.omChange < -0.05) {
    hits += 2;
    bits.push("마진 압축");
  }
  if (m.netDebtEbitda != null && m.netDebtEbitda > 4) {
    hits += 2;
    bits.push("과도 레버리지");
  }
  if (m.shareGrowth != null && m.shareGrowth > 0.2) {
    hits += 1;
    bits.push("희석");
  }
  if (m.accrual != null && m.accrual > 0.15) {
    hits += 1;
    bits.push("발생주의 위험");
  }
  if (fund != null && fund <= 3) {
    hits += 2;
    bits.push("펀더멘털 약함 + 낙폭");
  }
  const score = Math.min(10, Math.max(1, hits));
  return { score, reason: bits.join(" · ") || "뚜렷한 트랩 신호 부족" };
}

function classify(fund: number | null, oversold: number | null): OversoldCase {
  if (oversold != null && oversold <= 2) return "D";
  if (fund == null) return "B";
  if (fund >= 6) return "A";
  if (fund >= 4) return "B";
  return "C";
}

export function scoreOversold(m: DerivedMetrics): OversoldResult {
  const F = fundScore(m);
  const V = valScore(m);
  const O = oversoldPx(m);
  const R = riskInv(m);
  const parts = [F.score, V.score, O.score, R.score];
  const present = parts.filter((x) => x != null).length;
  const coverage = present / 4;
  const trap = trapScore(m, F.score);
  const opportunity =
    F.score != null && V.score != null && O.score != null && R.score != null
      ? opportunityScore(F.score, V.score, O.score, R.score)
      : present >= 3
        ? opportunityScore(F.score ?? 5, V.score ?? 5, O.score ?? 5, R.score ?? 5)
        : null;
  const status =
    coverage < 0.7 ? "RESEARCH REQUIRED" : coverage < 1 ? "PARTIAL" : "COMPLETE";
  return {
    version: OSM_VERSION,
    fundamental: F.score,
    valuation: V.score,
    oversold: O.score,
    riskInverse: R.score,
    opportunity,
    valueTrap: trap.score,
    case: classify(F.score, O.score),
    peakEarnings: V.peak,
    coverage,
    confidence: coverage >= 0.9 ? "High" : coverage >= 0.7 ? "Medium" : "Low",
    reasons: {
      fundamental: F.reason,
      valuation: V.reason,
      oversold: O.reason,
      risk: R.reason,
      trap: trap.reason,
    },
    status,
  };
}
