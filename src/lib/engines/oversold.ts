import type { DerivedMetrics } from "../metrics/derived.ts";
import { DEFAULT_CRITERIA } from "./criteria/defaults.ts";
import { getCriteria } from "./criteria/active.ts";
import type { OversoldCriteria } from "./criteria/types.ts";

export const OSM_VERSION = "OSM-v2.2";

export type OversoldCase = "A" | "B" | "C" | "D";
export type PeakEarningsLevel = "NONE" | "POSSIBLE" | "HIGH";
export type CaseStatus = "COMPLETE" | "INCOMPLETE";

export interface OversoldResult {
  version: string;
  fundamental: number | null;
  valuation: number | null;
  oversold: number | null;
  riskInverse: number | null;
  opportunity: number | null;
  valueTrap: number;
  case: OversoldCase | null;
  caseStatus: CaseStatus;
  peakEarnings: boolean;
  peakEarningsLevel: PeakEarningsLevel;
  coverage: number;
  availableWeight: number;
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

function weights(spec: OversoldCriteria) {
  return { F: spec.weights.fundamental, V: spec.weights.valuation, O: spec.weights.oversold, R: spec.weights.risk };
}

export function opportunityScore(f: number, v: number, o: number, r: number, spec: OversoldCriteria = DEFAULT_CRITERIA.engines.oversold): number {
  const W = weights(spec);
  return f * W.F + v * W.V + o * W.O + r * W.R;
}

/** N/A is excluded and remaining weights are renormalized. Zero is a valid score. */
export function opportunityScorePartial(
  f: number | null,
  v: number | null,
  o: number | null,
  r: number | null,
  spec: OversoldCriteria = DEFAULT_CRITERIA.engines.oversold,
): { score: number | null; coverage: number; availableWeight: number; observed: number } {
  const W = weights(spec);
  const parts: Array<[number | null, number]> = [
    [f, W.F],
    [v, W.V],
    [o, W.O],
    [r, W.R],
  ];
  let observed = 0;
  let available = 0;
  for (const [s, w] of parts) {
    if (s != null && Number.isFinite(s)) {
      observed += s * w;
      available += w;
    }
  }
  if (available === 0) return { score: null, coverage: 0, availableWeight: 0, observed: 0 };
  return {
    score: observed / available,
    coverage: available / (W.F + W.V + W.O + W.R),
    availableWeight: available,
    observed,
  };
}

function clamp10(n: number): number {
  return Math.min(10, Math.max(0, n));
}

function fundScore(m: DerivedMetrics, spec: OversoldCriteria): { score: number | null; reason: string } {
  const fund = spec.fundamental;
  if (m.revenueYoY == null && m.om == null && m.niTtm == null) {
    return { score: null, reason: "매출·이익 시계열 없음. N/A." };
  }
  let s = fund.base;
  const bits: string[] = [];
  if (m.revenueYoY != null) {
    const hit = fund.revenueYoY.find((row) => m.revenueYoY! > row.gt) ?? fund.revenueYoY.at(-1);
    if (hit) s += hit.delta;
    if (m.revenueYoY > 0) bits.push(`매출 +${(m.revenueYoY * 100).toFixed(0)}%`);
    else if (m.revenueYoY > -0.08) bits.push(`매출 소폭 감소`);
    else bits.push(`매출 ${(m.revenueYoY * 100).toFixed(0)}%`);
  }
  if (m.om != null) {
    if (m.om > fund.omHigh) s += fund.omHighDelta;
    else if (m.om < 0) s += fund.omNegDelta;
    bits.push(`OM ${(m.om * 100).toFixed(0)}%`);
  }
  if (m.omChange != null) {
    if (m.omChange > fund.omChangeUp) s += fund.omChangeUpDelta;
    else if (m.omChange < fund.omChangeDown) s += fund.omChangeDownDelta;
  }
  return { score: clamp10(s), reason: bits.join(" · ") || "부분 펀더멘털" };
}

function peakLevel(m: DerivedMetrics, spec: OversoldCriteria): PeakEarningsLevel {
  const v = spec.valuation;
  const reit = m.industryGroup === "reit";
  const bank = m.industryGroup === "financial";
  const peUsable = !reit && !bank;
  const revDown = m.revenueYoY != null && m.revenueYoY < 0;
  const highOm = m.om != null && m.om > v.peakOm;
  const compress = m.omChange != null && m.omChange < spec.trap.omCompress;
  const cheapPe = peUsable && m.pe != null && m.pe < v.peakPe;
  const weakCash = (m.cashConversion != null && m.cashConversion < 0.7) || (m.fcf != null && m.niTtm != null && m.niTtm > 0 && m.fcf < 0);
  const accrual = m.accrual != null && m.accrual > spec.trap.accrual;
  let hits = 0;
  if (revDown) hits++;
  if (highOm || compress) hits++;
  if (cheapPe) hits++;
  if (weakCash) hits++;
  if (accrual) hits++;
  if (hits >= 3 && (revDown || cheapPe)) return "HIGH";
  if (hits >= 2) return "POSSIBLE";
  return "NONE";
}

function valScore(m: DerivedMetrics, spec: OversoldCriteria): { score: number | null; reason: string; peak: PeakEarningsLevel } {
  const v = spec.valuation;
  const peak = peakLevel(m, spec);
  const reit = m.industryGroup === "reit";
  const bank = m.industryGroup === "financial";
  const peUsable = !reit && !bank;
  const evsUsable = !bank;
  if ((evsUsable ? m.evSales : null) == null && (peUsable ? m.pe : null) == null && m.pb == null) {
    return {
      score: null,
      reason: reit
        ? "REIT: 보통 P/E 강제 없음. FFO/P/FFO 자료 없음. N/A."
        : bank
          ? "Financial: 제조업 EV/S·P/E 강제 없음. P/B 없음. N/A."
          : "밸류에이션 배수 없음. N/A.",
      peak: "NONE",
    };
  }
  let s = 5;
  const bits: string[] = [];
  if (evsUsable && m.evSales != null) {
    bits.push(`EV/S ${m.evSales.toFixed(1)}x`);
    const hit = v.evSales.find((row) => m.evSales! < row.lt);
    s += hit ? hit.delta : -3;
  }
  if (peUsable && m.pe != null) {
    bits.push(`P/E ${m.pe.toFixed(1)}x`);
    if (m.pe < v.peCheap) s += v.peCheapDelta;
    else if (m.pe > v.peRich) s += v.peRichDelta;
  }
  if (m.pb != null && (reit || bank)) {
    bits.push(`P/B ${m.pb.toFixed(2)}x`);
    if (m.pb < v.pbCheap) s += v.pbCheapDelta;
    else if (m.pb < v.pbOk) s += v.pbOkDelta;
    else if (m.pb > v.pbRich) s += v.pbRichDelta;
  }
  if (peak !== "NONE" && peUsable) {
    s += v.peakPenalty;
    bits.push(peak === "HIGH" ? "Peak earnings HIGH — 저배수 ≠ 저평가" : "Peak earnings POSSIBLE");
  }
  return { score: clamp10(s), reason: bits.join(" · "), peak };
}

function oversoldPx(m: DerivedMetrics, spec: OversoldCriteria): { score: number | null; reason: string } {
  const p = spec.price;
  if (m.drawdown52w == null && m.return3m == null && m.return6m == null) {
    return { score: null, reason: "52주 고점·수익률 없음. N/A." };
  }
  const dd = m.drawdown52w;
  if (dd == null) {
    const r = m.return6m ?? m.return3m;
    if (r == null) return { score: null, reason: "가격 낙폭 없음. N/A." };
    if (r >= 0) return { score: 1, reason: "최근 수익률 음수 아님 — 과매도 명제 약함" };
    const s = r < -0.35 ? 8 : r < -0.2 ? 6 : 4;
    return { score: s, reason: `최근 수익률 ${(r * 100).toFixed(0)}%` };
  }
  if (dd <= p.nearHigh) return { score: p.nearHighScore, reason: "52주 고점 근처 — Case D 후보" };
  const hit = p.ddBands.find((row) => dd < row.lt);
  if (hit) return { score: hit.score, reason: `낙폭 ${(dd * 100).toFixed(0)}%` };
  return { score: 9, reason: `낙폭 ${(dd * 100).toFixed(0)}% — 가격만으로 결론 금지` };
}

function riskInv(m: DerivedMetrics, spec: OversoldCriteria): { score: number | null; reason: string } {
  const r = spec.risk;
  if (m.netDebt == null && m.cash == null && m.shareGrowth == null && m.fcf == null && m.customerConcentration == null) {
    return { score: null, reason: "부채·현금·희석 자료 없음. N/A." };
  }
  let s = r.base;
  const bits: string[] = [];
  if (m.netDebt != null && m.cash != null) {
    if (m.netDebt < 0) {
      s += r.netCashDelta;
      bits.push("순현금");
    } else if (m.netDebtEbitda != null && m.netDebtEbitda > r.ndEbitdaHigh) {
      s += r.ndEbitdaHighDelta;
      bits.push(`Net debt/EBITDA ${m.netDebtEbitda.toFixed(1)}x`);
    } else {
      bits.push("순부채 존재");
    }
  } else {
    bits.push("부채 커버리지 부분");
  }
  if (m.shareGrowth != null) {
    if (m.shareGrowth > r.dilutionHigh) {
      s += r.dilutionHighDelta;
      bits.push(`희석 ${(m.shareGrowth * 100).toFixed(0)}%`);
    } else if (m.shareGrowth < 0) {
      s += r.buybackDelta;
      bits.push("자사주/감소");
    }
  }
  if (m.customerConcentration != null && m.customerConcentration > r.concentrationHigh) {
    s += r.concentrationDelta;
    bits.push("고객 집중");
  }
  if (m.fcf != null && m.fcf < 0) {
    s += r.fcfNegDelta;
    bits.push("FCF 적자");
  }
  return { score: clamp10(s), reason: bits.join(" · ") || "리스크 부분 평가" };
}

function trapScore(m: DerivedMetrics, fund: number | null, spec: OversoldCriteria): { score: number; reason: string } {
  const t = spec.trap;
  let hits = 0;
  const bits: string[] = [];
  if (m.revenueYoY != null && m.revenueYoY < t.revenueDrop) {
    hits += t.revenueDropHits;
    bits.push("구조적 매출 감소 가능");
  }
  if (m.omChange != null && m.omChange < t.omCompress) {
    hits += t.omCompressHits;
    bits.push("마진 압축");
  }
  if (m.netDebtEbitda != null && m.netDebtEbitda > t.leverage) {
    hits += t.leverageHits;
    bits.push("과도 레버리지");
  }
  if (m.shareGrowth != null && m.shareGrowth > t.dilution) {
    hits += t.dilutionHits;
    bits.push("희석");
  }
  if (m.accrual != null && m.accrual > t.accrual) {
    hits += t.accrualHits;
    bits.push("발생주의 위험");
  }
  if (fund != null && fund <= t.weakFund) {
    hits += t.weakFundHits;
    bits.push("펀더멘털 약함 + 낙폭");
  }
  const score = Math.min(10, Math.max(0, hits));
  return { score, reason: bits.join(" · ") || "detected trap signal 없음" };
}

function classify(
  fund: number | null,
  oversold: number | null,
  spec: OversoldCriteria,
): { case: OversoldCase | null; caseStatus: CaseStatus } {
  if (fund == null || oversold == null) return { case: null, caseStatus: "INCOMPLETE" };
  if (oversold <= spec.classify.caseDOversoldMax) return { case: "D", caseStatus: "COMPLETE" };
  if (fund >= spec.classify.caseAFundMin) return { case: "A", caseStatus: "COMPLETE" };
  if (fund >= spec.classify.caseBFundMin) return { case: "B", caseStatus: "COMPLETE" };
  return { case: "C", caseStatus: "COMPLETE" };
}

export function scoreOversold(m: DerivedMetrics, criteria?: OversoldCriteria): OversoldResult {
  const spec = criteria ?? getCriteria().engines.oversold;
  const F = fundScore(m, spec);
  const V = valScore(m, spec);
  const O = oversoldPx(m, spec);
  const R = riskInv(m, spec);
  const part = opportunityScorePartial(F.score, V.score, O.score, R.score, spec);
  const trap = trapScore(m, F.score, spec);
  const classified = classify(F.score, O.score, spec);
  const status =
    part.coverage < spec.coverage.researchBelow
      ? "RESEARCH REQUIRED"
      : part.coverage < spec.coverage.partialBelow
        ? "PARTIAL"
        : "COMPLETE";
  return {
    version: spec.version,
    fundamental: F.score,
    valuation: V.score,
    oversold: O.score,
    riskInverse: R.score,
    opportunity: part.score == null ? null : Number(part.score.toFixed(2)),
    valueTrap: trap.score,
    case: classified.case,
    caseStatus: classified.caseStatus,
    peakEarnings: V.peak !== "NONE",
    peakEarningsLevel: V.peak,
    coverage: part.coverage,
    availableWeight: part.availableWeight,
    confidence: part.coverage >= 0.9 ? "High" : part.coverage >= 0.7 ? "Medium" : "Low",
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
