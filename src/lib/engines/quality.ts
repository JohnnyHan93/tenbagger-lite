import type { DerivedMetrics } from "../metrics/derived.ts";
import type { Applicability, IndustryGroup } from "./industry.ts";
import { naForGroup } from "./industry.ts";

export const MFC70_VERSION = "MFC70-v1.2";
export const MFC74_VERSION = "MFC74-v3.0";

export type FactorClass = "Core" | "Conditional" | "Diagnostic";
export type RedFlagLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface QualityFactorDef {
  id: string;
  pillar: string;
  name: string;
  kind: FactorClass;
  apply: (g: IndustryGroup) => Applicability;
  score: (m: DerivedMetrics) => { score: number | null; reason: string; calc: string };
}

export interface QualityFactorResult {
  id: string;
  pillar: string;
  name: string;
  kind: FactorClass;
  applicability: Applicability;
  score: number | null;
  weight: number;
  weightedScore: number | null;
  coverage: number;
  confidence: "High" | "Medium" | "Low";
  reason: string;
  calculation: string;
  status: "SCORED" | "NA" | "DIAGNOSTIC";
}

export interface QualityResult {
  version: typeof MFC70_VERSION;
  score: number | null;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  coverage: number;
  eligibleCount: number;
  scoredCount: number;
  pillars: Array<{ pillar: string; score: number | null; coverage: number }>;
  factors: QualityFactorResult[];
  diagnostics: QualityFactorResult[];
  redFlag: RedFlagLevel;
  status: "COMPLETE" | "PARTIAL" | "RESEARCH REQUIRED";
}

function band(
  v: number | null,
  steps: Array<[number, number]>,
  reason: string,
  calc: string,
): { score: number | null; reason: string; calc: string } {
  if (v == null || !Number.isFinite(v)) return { score: null, reason: `${reason} 자료 없음. N/A.`, calc };
  for (const [th, s] of steps) {
    if (v >= th) return { score: s, reason, calc: `${calc}=${v.toFixed(3)}` };
  }
  return { score: steps.at(-1)?.[1] ?? 0, reason, calc: `${calc}=${v.toFixed(3)}` };
}

function invBand(
  v: number | null,
  steps: Array<[number, number]>,
  reason: string,
  calc: string,
): { score: number | null; reason: string; calc: string } {
  if (v == null || !Number.isFinite(v)) return { score: null, reason: `${reason} 자료 없음. N/A.`, calc };
  for (const [th, s] of steps) {
    if (v <= th) return { score: s, reason, calc: `${calc}=${v.toFixed(3)}` };
  }
  return { score: 2, reason, calc: `${calc}=${v.toFixed(3)}` };
}

const A = (_g: IndustryGroup): Applicability => "A";

export const QUALITY_FACTORS: QualityFactorDef[] = [
  { id: "Q01", pillar: "Growth", name: "Revenue Growth", kind: "Core", apply: A, score: (m) => band(m.revenueYoY, [[0.3, 10], [0.15, 8], [0.08, 6], [0.03, 4], [0, 2], [-1, 0]], "YoY 매출", "revYoY") },
  { id: "Q02", pillar: "Growth", name: "3Y Revenue CAGR", kind: "Core", apply: A, score: (m) => band(m.revenueCagr3y, [[0.2, 10], [0.12, 8], [0.07, 6], [0.03, 4], [0, 2], [-1, 0]], "3Y CAGR", "cagr3") },
  { id: "Q03", pillar: "Growth", name: "OP Growth", kind: "Core", apply: A, score: (m) => band(m.opGrowth, [[0.3, 10], [0.15, 8], [0.05, 6], [0, 4], [-0.1, 2], [-9, 0]], "영업이익 성장", "opYoY") },
  { id: "Q04", pillar: "Growth", name: "EPS Growth", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "희석 EPS 시계열 없음. OP 성장으로 대체하지 않음.", calc: "epsYoY" }) },
  { id: "Q05", pillar: "Growth", name: "Growth Acceleration", kind: "Core", apply: A, score: (m) => {
    if (m.revenueYoY == null || m.revenueCagr3y == null) return { score: null, reason: "가속 비교 시계열 없음.", calc: "yoy-cagr3" };
    const d = m.revenueYoY - m.revenueCagr3y;
    return band(d, [[0.1, 10], [0.03, 8], [0, 6], [-0.05, 4], [-9, 2]], "YoY vs 3Y CAGR", "accel");
  } },
  { id: "Q06", pillar: "Growth", name: "Profit Growth Leverage", kind: "Core", apply: A, score: (m) => {
    if (m.opGrowth == null || m.revenueYoY == null) return { score: null, reason: "레버리지 계산 불가.", calc: "op/rev" };
    if (m.revenueYoY <= 0) return { score: 2, reason: "매출 비성장", calc: "n/a" };
    return band(m.opGrowth - m.revenueYoY, [[0.1, 10], [0, 8], [-0.05, 5], [-9, 2]], "이익 성장 − 매출 성장", "Δ");
  } },
  { id: "Q07", pillar: "Growth", name: "Sequential Growth", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "분기 시계열 없음.", calc: "qoq" }) },
  { id: "Q08", pillar: "Growth", name: "Organic vs M&A", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "유기성장 공시 없음.", calc: "organic" }) },
  { id: "Q09", pillar: "Profitability", name: "Gross Margin", kind: "Core", apply: (g) => (g === "financial" || g === "reit" ? "N" : "A"), score: (m) => band(m.gm, [[0.7, 10], [0.5, 8], [0.35, 6], [0.2, 4], [0, 2], [-9, 0]], "GM", "gm") },
  { id: "Q10", pillar: "Profitability", name: "Operating Margin", kind: "Core", apply: A, score: (m) => band(m.om, [[0.25, 10], [0.15, 8], [0.08, 6], [0.02, 4], [0, 2], [-9, 0]], "OM", "om") },
  { id: "Q11", pillar: "Profitability", name: "Net Margin", kind: "Core", apply: A, score: (m) => band(m.nm, [[0.18, 10], [0.1, 8], [0.05, 6], [0, 4], [-0.05, 2], [-9, 0]], "NM", "nm") },
  { id: "Q12", pillar: "Profitability", name: "Margin Change", kind: "Core", apply: A, score: (m) => band(m.omChange, [[0.03, 10], [0.01, 8], [0, 6], [-0.03, 4], [-9, 2]], "OM 변화", "dOM") },
  { id: "Q13", pillar: "Profitability", name: "ROIC", kind: "Core", apply: (g) => naForGroup(g, "roic"), score: (m) => band(m.roic, [[0.2, 10], [0.12, 8], [0.08, 6], [0.04, 4], [0, 2], [-9, 0]], "ROIC", "roic") },
  { id: "Q14", pillar: "Profitability", name: "ROIC Change", kind: "Conditional", apply: (g) => naForGroup(g, "roic"), score: (m) => band(m.roicChange, [[0.03, 10], [0, 7], [-0.03, 4], [-9, 2]], "ROIC 변화", "dRoic") },
  { id: "Q15", pillar: "Profitability", name: "Gross Margin Stability", kind: "Conditional", apply: (g) => (g === "financial" ? "N" : "C"), score: (m) => band(m.gmChange == null ? null : -Math.abs(m.gmChange), [[-0.01, 8], [-0.03, 6], [-0.08, 4], [-9, 2]], "GM 변동 역수", "|dGM|") },
  { id: "Q16", pillar: "Profitability", name: "Operating Leverage", kind: "Core", apply: A, score: (m) => {
    if (m.opGrowth == null || m.revenueYoY == null || m.revenueYoY === 0) return { score: null, reason: "증분 OM 계산 불가.", calc: "incOM" };
    return band(m.opGrowth / m.revenueYoY, [[1.5, 10], [1.1, 8], [0.8, 6], [0, 3], [-9, 1]], "OP성장/매출성장", "incLev");
  } },
  { id: "Q17", pillar: "Cash", name: "CFO Margin", kind: "Core", apply: A, score: (m) => band(m.cfoMargin, [[0.2, 10], [0.12, 8], [0.05, 6], [0, 4], [-9, 1]], "CFO 마진", "cfoM") },
  { id: "Q18", pillar: "Cash", name: "Cash Conversion", kind: "Core", apply: A, score: (m) => band(m.cashConversion, [[1.1, 10], [0.9, 8], [0.7, 6], [0.4, 4], [0, 2], [-9, 0]], "CFO/NI", "cc") },
  { id: "Q19", pillar: "Cash", name: "FCF Margin", kind: "Core", apply: A, score: (m) => band(m.fcfMargin, [[0.15, 10], [0.08, 8], [0.03, 6], [0, 4], [-9, 1]], "FCF 마진", "fcfM") },
  { id: "Q20", pillar: "Cash", name: "3Y FCF", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "3Y FCF 시계열 없음. 단년 FCF로 대체하지 않음.", calc: "fcf3" }) },
  { id: "Q21", pillar: "Cash", name: "CFO Growth", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "CFO 시계열 없음.", calc: "cfoG" }) },
  { id: "Q22", pillar: "Cash", name: "Positive CFO Persistence", kind: "Core", apply: A, score: (m) => (m.cfo == null ? { score: null, reason: "CFO 없음.", calc: "cfo" } : { score: m.cfo > 0 ? 8 : 2, reason: m.cfo > 0 ? "CFO 양수" : "CFO 음수", calc: "sign" }) },
  { id: "Q23", pillar: "Cash", name: "Accrual Ratio", kind: "Diagnostic", apply: A, score: (m) => invBand(m.accrual, [[0.05, 8], [0.1, 6], [0.2, 3], [9, 1]], "발생액", "accrual") },
  { id: "Q24", pillar: "Cash", name: "FCF vs NI", kind: "Core", apply: A, score: (m) => band(ratioSafe(m.fcf, m.niTtm), [[0.9, 10], [0.6, 7], [0.3, 4], [-9, 2]], "FCF/NI", "fcf/ni") },
  { id: "Q25", pillar: "Working Capital", name: "AR Growth Gap", kind: "Core", apply: (g) => (g === "financial" ? "N" : "A"), score: (m) => invBand(m.arGrowthGap, [[0.02, 8], [0.08, 6], [0.15, 3], [9, 1]], "AR 성장 − 매출 성장", "arGap") },
  { id: "Q26", pillar: "Working Capital", name: "Inventory Growth Gap", kind: "Core", apply: (g) => naForGroup(g, "inventory"), score: (m) => invBand(m.invGrowthGap, [[0.02, 8], [0.1, 5], [0.2, 2], [9, 1]], "재고 성장 갭", "invGap") },
  { id: "Q27", pillar: "Working Capital", name: "CCC Change", kind: "Conditional", apply: (g) => (g === "saas" || g === "financial" ? "N" : "C"), score: (m) => invBand(m.cccChange, [[0, 8], [5, 6], [15, 3], [99, 1]], "CCC 변화(일)", "dCCC") },
  { id: "Q28", pillar: "Working Capital", name: "NWC Burden", kind: "Conditional", apply: (g) => (g === "financial" ? "N" : "C"), score: () => ({ score: null, reason: "NWC 공시 없음.", calc: "nwc" }) },
  { id: "Q29", pillar: "Working Capital", name: "Contract Asset Growth", kind: "Diagnostic", apply: (g) => (g === "saas" ? "A" : "C"), score: () => ({ score: null, reason: "계약자산 없음.", calc: "ca" }) },
  { id: "Q30", pillar: "Balance Sheet", name: "Net Debt / EBITDA", kind: "Core", apply: (g) => naForGroup(g, "de"), score: (m) => {
    if (m.netDebt != null && m.netDebt < 0) return { score: 10, reason: "순현금", calc: "netCash" };
    return invBand(m.netDebtEbitda, [[0.5, 10], [1.5, 8], [2.5, 6], [4, 3], [99, 1]], "Net debt/EBITDA", "nd/ebitda");
  } },
  { id: "Q31", pillar: "Balance Sheet", name: "Interest Coverage", kind: "Core", apply: (g) => naForGroup(g, "de"), score: (m) => band(m.interestCoverage, [[10, 10], [5, 8], [3, 6], [1.5, 3], [0, 1]], "이자보상", "intCov") },
  { id: "Q32", pillar: "Balance Sheet", name: "Cash Interest Coverage", kind: "Conditional", apply: (g) => naForGroup(g, "de"), score: () => ({ score: null, reason: "현금 이자보상 원자료 없음. 발생주의 이자보상으로 대체하지 않음.", calc: "cashInt" }) },
  { id: "Q33", pillar: "Balance Sheet", name: "ST Debt / Cash", kind: "Core", apply: A, score: (m) => invBand(m.stDebtToCash, [[0.3, 10], [0.7, 7], [1, 4], [99, 1]], "단기차입/현금", "st/cash") },
  { id: "Q34", pillar: "Balance Sheet", name: "Debt Concentration", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "만기 분포 없음.", calc: "mat" }) },
  { id: "Q35", pillar: "Balance Sheet", name: "Debt Growth Gap", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "부채 시계열 없음.", calc: "dDebt" }) },
  { id: "Q36", pillar: "Balance Sheet", name: "Cash / Assets", kind: "Core", apply: A, score: (m) => band(m.cashToAssets, [[0.3, 9], [0.15, 7], [0.08, 5], [0.03, 3], [0, 2]], "현금/자산", "cash/assets") },
  { id: "Q37", pillar: "Capital Efficiency", name: "Invested Capital Turnover", kind: "Core", apply: A, score: (m) => band(m.assetTurnover, [[1.2, 10], [0.8, 8], [0.5, 6], [0.3, 4], [0, 2]], "자산회전 프록시", "AT") },
  { id: "Q38", pillar: "Capital Efficiency", name: "Incremental ROIC", kind: "Conditional", apply: (g) => naForGroup(g, "roic"), score: () => ({ score: null, reason: "증분 ROIC 없음.", calc: "iROIC" }) },
  { id: "Q39", pillar: "Capital Efficiency", name: "Asset Turnover", kind: "Core", apply: A, score: (m) => band(m.assetTurnover, [[1.5, 10], [0.9, 8], [0.5, 6], [0.25, 4], [0, 2]], "Asset Turnover", "AT") },
  { id: "Q40", pillar: "Capital Efficiency", name: "PPE Turnover", kind: "Conditional", apply: (g) => (g === "saas" || g === "financial" ? "C" : "A"), score: () => ({ score: null, reason: "PPE 없음.", calc: "ppeT" }) },
  { id: "Q41", pillar: "Capital Efficiency", name: "Cash ROIC", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "Cash ROIC 원자료 없음. 회계 ROIC로 복사하지 않음.", calc: "croic" }) },
  { id: "Q42", pillar: "Capital Efficiency", name: "CAPEX Productivity", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "CAPEX 생산성 없음.", calc: "capexP" }) },
  { id: "Q43", pillar: "Reinvestment", name: "CAPEX / Revenue", kind: "Core", apply: A, score: (m) => invBand(m.capexToRev, [[0.04, 8], [0.08, 7], [0.15, 5], [0.3, 3], [9, 2]], "CAPEX/매출", "capex/rev") },
  { id: "Q44", pillar: "Reinvestment", name: "CAPEX / CFO", kind: "Conditional", apply: A, score: (m) => {
    if (m.capex == null || m.cfo == null || m.cfo === 0) return { score: null, reason: "CAPEX/CFO 계산 자료 없음.", calc: "capex/cfo" };
    return invBand(Math.abs(m.capex) / Math.abs(m.cfo), [[0.3, 8], [0.6, 6], [1, 4], [9, 2]], "CAPEX/CFO", "capex/cfo");
  } },
  { id: "Q45", pillar: "Reinvestment", name: "PPE Growth", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "PPE 성장 없음.", calc: "ppeG" }) },
  { id: "Q46", pillar: "Reinvestment", name: "R&D / Revenue", kind: "Core", apply: (g) => naForGroup(g, "rd"), score: (m) => band(m.rdToRev, [[0.12, 8], [0.06, 7], [0.03, 5], [0, 4]], "R&D/매출", "rd/rev") },
  { id: "Q47", pillar: "Reinvestment", name: "R&D Growth", kind: "Conditional", apply: (g) => naForGroup(g, "rd"), score: (m) => band(m.rdGrowth, [[0.15, 8], [0.05, 6], [0, 4], [-9, 2]], "R&D 성장", "rdG") },
  { id: "Q48", pillar: "Reinvestment", name: "Backlog Growth", kind: "Conditional", apply: (g) => naForGroup(g, "backlog"), score: (m) => band(m.backlogGrowth, [[0.2, 10], [0.1, 8], [0.03, 6], [0, 4], [-9, 2]], "백로그 성장", "blG") },
  { id: "Q49", pillar: "Reinvestment", name: "Backlog Coverage", kind: "Conditional", apply: (g) => naForGroup(g, "backlog"), score: () => ({ score: null, reason: "백로그/매출 커버 없음.", calc: "blCov" }) },
  { id: "Q50", pillar: "Reinvestment", name: "Book-to-Bill", kind: "Conditional", apply: (g) => (g === "semi" || g === "industrial" ? "A" : "C"), score: (m) => band(m.bookToBill, [[1.2, 10], [1.05, 8], [0.95, 5], [0, 2]], "Book-to-bill", "b2b") },
  { id: "Q51", pillar: "Reinvestment", name: "Contract Liability Growth", kind: "Conditional", apply: (g) => (g === "saas" ? "A" : "C"), score: () => ({ score: null, reason: "계약부채 없음.", calc: "cl" }) },
  { id: "Q52", pillar: "Shareholder", name: "Customer Concentration", kind: "Core", apply: A, score: (m) => invBand(m.customerConcentration, [[0.15, 9], [0.3, 6], [0.5, 3], [9, 1]], "고객 집중", "conc") },
  { id: "Q53", pillar: "Shareholder", name: "Share Count Growth", kind: "Core", apply: A, score: (m) => invBand(m.shareGrowth, [[0.01, 10], [0.04, 7], [0.1, 4], [9, 1]], "주식수 증가", "shares") },
  { id: "Q54", pillar: "Shareholder", name: "3Y Dilution", kind: "Core", apply: A, score: () => ({ score: null, reason: "3Y 주식수 시계열 없음. 1Y 희석으로 대체하지 않음.", calc: "dil3" }) },
  { id: "Q55", pillar: "Shareholder", name: "Potential Dilution", kind: "Conditional", apply: A, score: () => ({ score: null, reason: "옵션/전환사채 없음.", calc: "potDil" }) },
  { id: "Q56", pillar: "Shareholder", name: "EPS vs NI Gap", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "희석 EPS 공시 없음.", calc: "epsGap" }) },
  { id: "Q57", pillar: "Shareholder", name: "External Funding Dependence", kind: "Core", apply: A, score: (m) => {
    if (m.fcf == null) return { score: null, reason: "FCF 없음.", calc: "fund" };
    return { score: m.fcf > 0 ? 8 : 3, reason: m.fcf > 0 ? "자체 자금" : "외부 자금 의존 가능", calc: "fcfSign" };
  } },
  { id: "Q58", pillar: "Accounting", name: "Goodwill Change", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "영업권 변동 없음.", calc: "gw" }) },
  { id: "Q59", pillar: "Accounting", name: "Intangible Growth Gap", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "무형자산 없음.", calc: "intan" }) },
  { id: "Q60", pillar: "Accounting", name: "Related Party Receivables", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "특수관계 없음.", calc: "rp" }) },
  { id: "Q61", pillar: "Accounting", name: "Audit Opinion", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "감사의견 원문 없음.", calc: "audit" }) },
  { id: "Q62", pillar: "Accounting", name: "Non-core Income", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "비핵심이익 분해 없음.", calc: "noncore" }) },
  { id: "Q63", pillar: "Accounting", name: "Capitalized R&D", kind: "Diagnostic", apply: (g) => naForGroup(g, "rd"), score: () => ({ score: null, reason: "R&D 자산화 여부 없음.", calc: "capRd" }) },
  { id: "Q64", pillar: "Accounting", name: "Revenue Recognition", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "수익인식 정책 미평가.", calc: "revrec" }) },
  { id: "Q65", pillar: "Accounting", name: "One-time Items", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "일회성 항목 없음.", calc: "oneoff" }) },
  { id: "Q66", pillar: "Accounting", name: "Related Party", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "특수관계 거래 없음.", calc: "rp2" }) },
  { id: "Q67", pillar: "Accounting", name: "Off-balance Commitments", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "난외 약정 없음.", calc: "off" }) },
  { id: "Q68", pillar: "Accounting", name: "Pension / Lease", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "연금·리스 세부 없음.", calc: "pen" }) },
  { id: "Q69", pillar: "Accounting", name: "Restatement", kind: "Diagnostic", apply: A, score: () => ({ score: null, reason: "재작성 여부 미확인.", calc: "rest" }) },
  { id: "Q70", pillar: "Accounting", name: "Going Concern", kind: "Diagnostic", apply: A, score: (m) => {
    if (m.cash == null && m.fcf == null) return { score: null, reason: "계속기업 판단 자료 부족.", calc: "gc" };
    const tight = (m.cash ?? 0) < 0 || ((m.fcf ?? 0) < 0 && (m.cash ?? 0) < Math.abs(m.fcf ?? 0));
    return { score: tight ? 2 : 8, reason: tight ? "유동성 스트레스 가능" : "계속기업 적신호 없음", calc: "gc" };
  } },
];

function ratioSafe(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

export function scoreQuality(m: DerivedMetrics): QualityResult {
  const factors: QualityFactorResult[] = QUALITY_FACTORS.map((def) => {
    const applicability = def.apply(m.industryGroup);
    if (applicability === "N" || applicability === "R") {
      return {
        id: def.id,
        pillar: def.pillar,
        name: def.name,
        kind: def.kind,
        applicability,
        score: null,
        weight: 1,
        weightedScore: null,
        coverage: 0,
        confidence: "Low",
        reason:
          applicability === "R"
            ? "업종 대체 지표 없음. 제조업 공식을 강제하지 않음. N/A."
            : "업종 N/A — 분모에서 제외",
        calculation: applicability === "R" ? "industry R" : "industry N",
        status: "NA",
      };
    }
    const raw = def.score(m);
    const scored = raw.score != null;
    return {
      id: def.id,
      pillar: def.pillar,
      name: def.name,
      kind: def.kind,
      applicability,
      score: raw.score,
      weight: 1,
      weightedScore: raw.score,
      coverage: scored ? 1 : 0,
      confidence: scored ? "Medium" : "Low",
      reason: raw.reason,
      calculation: raw.calc,
      status: def.kind === "Diagnostic" ? "DIAGNOSTIC" : scored ? "SCORED" : "NA",
    };
  });

  const eligible = factors.filter(
    (f) => f.kind !== "Diagnostic" && f.applicability !== "N" && f.applicability !== "R",
  );
  const scored = eligible.filter((f) => f.score != null);
  const coverage = eligible.length ? scored.length / eligible.length : 0;
  const mean =
    scored.length > 0 ? scored.reduce((s, f) => s + (f.score as number), 0) / scored.length : null;
  const score = mean == null ? null : (mean / 10) * 100;
  const diagnostics = factors.filter((f) => f.kind === "Diagnostic");
  const redHits = diagnostics.filter((d) => d.score != null && d.score <= 2).length;
  const knownDiag = diagnostics.filter((d) => d.score != null).length;
  const redFlag: RedFlagLevel =
    knownDiag === 0 ? "UNKNOWN" : redHits >= 2 ? "RED" : redHits === 1 ? "YELLOW" : "GREEN";

  const pillarNames = [...new Set(eligible.map((f) => f.pillar))];
  const pillars = pillarNames.map((pillar) => {
    const rows = eligible.filter((f) => f.pillar === pillar);
    const ok = rows.filter((f) => f.score != null);
    return {
      pillar,
      score: ok.length ? ok.reduce((s, f) => s + (f.score as number), 0) / ok.length : null,
      coverage: rows.length ? ok.length / rows.length : 0,
    };
  });

  const grade =
    score == null ? "F" : score >= 85 ? "S" : score >= 75 ? "A" : score >= 65 ? "B" : score >= 55 ? "C" : score >= 45 ? "D" : "F";

  return {
    version: MFC70_VERSION,
    score,
    grade,
    coverage,
    eligibleCount: eligible.length,
    scoredCount: scored.length,
    pillars,
    factors,
    diagnostics,
    redFlag,
    status: coverage < 0.7 ? "RESEARCH REQUIRED" : coverage < 0.9 ? "PARTIAL" : "COMPLETE",
  };
}

export function assertSeventyFactors(): number {
  return QUALITY_FACTORS.length;
}

export type QualityImplStatus = "IMPLEMENTED" | "MANUAL_ONLY" | "N/A_BY_DESIGN";

const MANUAL = new Set([
  "Q04", "Q07", "Q08", "Q20", "Q21", "Q28", "Q29", "Q32", "Q34", "Q35",
  "Q38", "Q40", "Q41", "Q42", "Q45", "Q49", "Q51", "Q54", "Q55", "Q56",
  "Q58", "Q59", "Q60", "Q61", "Q62", "Q63", "Q64", "Q65", "Q66", "Q67", "Q68", "Q69",
]);

export function qualityImplStatus(id: string, kind: FactorClass): QualityImplStatus {
  if (MANUAL.has(id)) return "MANUAL_ONLY";
  if (kind === "Diagnostic" && MANUAL.has(id)) return "MANUAL_ONLY";
  return "IMPLEMENTED";
}

