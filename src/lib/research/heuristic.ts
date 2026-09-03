import { FACTOR_ORDER, FACTOR_META, type FactorCode } from "../scoring/config.ts";
import { makeFlag } from "../risk/flags.ts";
import {
  defaultScenarios,
  feasibilityFromMath,
  requiredEvSalesFor10x,
  requiredNetIncomeFor10x,
  requiredPeFor10x,
  requiredRevenueFor10x,
} from "../tenx/calculator.ts";
import { formatMoney, formatPct } from "../format.ts";
import type {
  Evidence,
  RedFlag,
  ResearchDraft,
  ResearchQuote,
} from "../types.ts";

function evId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function heuristicDraft(quote: ResearchQuote): ResearchDraft {
  const { marketCap, financials, currency } = quote;
  const rev = financials.revenueTtm;
  const prior = financials.revenuePrior;
  const cash = financials.cash ?? 0;
  const debt = financials.totalDebt ?? 0;
  const op = financials.operatingIncomeTtm;
  const fcf = financials.fcf;
  const growth =
    rev != null && prior && prior > 0 ? rev / prior - 1 : null;
  const salesMultiple =
    rev != null && rev > 0 && marketCap > 0 ? marketCap / rev : null;
  const burn = Math.max(
    0,
    -(fcf ?? 0),
    op != null && op < 0 ? -op : 0,
  );
  const runwayYears = burn > 0 && cash > 0 ? cash / burn : null;

  let f2 = 1;
  let f2s = "매출 숫자 없음. 2점 조건: 최근 연간 매출이 전년 대비 +40% 이상.";
  if (growth != null && rev != null && prior != null) {
    if (growth >= 0.4) {
      f2 = 2;
      f2s = `매출 ${formatMoney(prior, currency)} → ${formatMoney(rev, currency)} (${formatPct(growth)}). 고성장 확인.`;
    } else if (growth >= 0.15) {
      f2 = 1;
      f2s = `매출 성장 ${formatPct(growth)}. 2점 조건: +40% 이상 가속.`;
    } else if (growth < 0) {
      f2 = 0;
      f2s = `매출 감소 ${formatPct(growth)}.`;
    } else {
      f2 = 1;
      f2s = `매출 성장 ${formatPct(growth)}로 완만. 2점 조건: 가속 확인.`;
    }
  }

  let f7 = 1;
  let survival: RedFlag = makeFlag(
    "SURVIVAL",
    "YELLOW",
    "현금·부채·CFO를 완전 확인하지 못함. 보수적으로 YELLOW.",
  );
  if (op != null && op > 0 && cash >= debt) {
    f7 = 2;
    survival = makeFlag(
      "SURVIVAL",
      "GREEN",
      `영업흑자 ${formatMoney(op, currency)} · 순현금 성격. 단기 생존 위험 낮음.`,
    );
  } else if (runwayYears != null && runwayYears < 1) {
    f7 = 0;
    survival = makeFlag(
      "SURVIVAL",
      "RED",
      `런웨이 약 ${runwayYears.toFixed(1)}년. 현금 고갈·희석 위험.`,
    );
  } else if (op != null && op < 0) {
    f7 = 1;
    const run =
      runwayYears != null ? ` 현금 런웨이 약 ${runwayYears.toFixed(1)}년.` : "";
    survival = makeFlag(
      "SURVIVAL",
      "YELLOW",
      `영업적자 ${formatMoney(op, currency)}.${run} 2점은 CFO 흑자 전환 시.`,
    );
  }

  let f8 = 1;
  let f8s = "적정 수준으로 보수 평가.";
  let f10 = 1;
  let tenx = makeFlag(
    "TENX",
    "YELLOW",
    "10x가 가능하려면 강한 성공 가정이 필요. 자동 모드는 보수적으로 판정.",
  );

  if (marketCap >= 2e11 && currency === "USD") {
    f8 = 0;
    f10 = 0;
    f8s = "시총이 이미 커서 미래 기회가 상당 반영.";
    tenx = makeFlag(
      "TENX",
      "RED",
      "시총이 이미 커서 10배는 비현실적 매출·멀티플을 요구.",
    );
  } else if (marketCap >= 2e14 && currency === "KRW") {
    f8 = 0;
    f10 = 0;
    f8s = "시총이 이미 커서 10배는 비현실적.";
    tenx = makeFlag("TENX", "RED", "시총이 이미 커서 10배는 비현실적.");
  } else if (salesMultiple != null && salesMultiple >= 40) {
    f8 = 0;
    f10 = 0;
    f8s = `시총/매출 ${salesMultiple.toFixed(0)}x. 성공이 이미 상당 반영.`;
    tenx = makeFlag(
      "TENX",
      "YELLOW",
      `고멀티플 상태. 10배는 매출 ${formatMoney(requiredRevenueFor10x(marketCap, "EV_SALES", 8, 0.12), currency)} 경로가 필요.`,
    );
  } else if (salesMultiple != null && salesMultiple < 8 && marketCap < 1e10) {
    f8 = 2;
    f10 = 1;
    f8s = `시총/매출 ${salesMultiple.toFixed(1)}x. 미래 기회 대비 시총 여지.`;
    tenx = makeFlag(
      "TENX",
      "GREEN",
      "시총이 상대적으로 작아 10배 수학의 여지가 있음. 사업 검증은 수동 확인.",
    );
  } else if (marketCap >= 3e10 && currency === "USD") {
    f8 = 0;
    f10 = 1;
    f8s = "현재 시총에 성공이 상당 반영.";
    tenx = makeFlag(
      "TENX",
      "YELLOW",
      "현재 시총에서 10배는 TAM 확대와 높은 멀티플이 동시에 필요.",
    );
  } else if (marketCap > 0 && marketCap < 1e10 && currency === "USD") {
    f8 = 2;
    f10 = 1;
    f8s = "시총 대비 미래 기회 여지.";
    tenx = makeFlag(
      "TENX",
      "GREEN",
      "시총이 상대적으로 작아 10배 수학의 여지가 있음. 사업 검증은 수동 확인.",
    );
  } else if (currency === "KRW" && marketCap > 0 && marketCap < 1.5e13) {
    f8 = 2;
    f10 = 1;
    f8s = "시총 대비 미래 기회 여지.";
    tenx = makeFlag(
      "TENX",
      "GREEN",
      "시총 대비 10배 여지. 사업 검증은 수동 확인.",
    );
  }

  const { base, bull } = defaultScenarios(marketCap || 1, financials);
  const flags = [
    makeFlag(
      "MANAGEMENT",
      "YELLOW",
      "자동 모드는 거버넌스를 확인하지 못함. 공시·IR을 직접 볼 것.",
    ),
    survival,
    tenx,
  ];
  const feasibility = feasibilityFromMath([base, bull], f10, tenx.hardStop);

  const locked = (code: FactorCode, need: string) =>
    `${FACTOR_META[code].nameKo} — 공시 숫자만으로 2점 없음. 2점 조건: ${need}`;

  const summary: Record<FactorCode, { score: number; summary: string }> = {
    F1: { score: 1, summary: locked("F1", "구조적 TAM 성장의 3rd-party 또는 공시 근거") },
    F2: { score: f2, summary: f2s },
    F3: { score: 1, summary: locked("F3", "반복매출·영업레버리지가 숫자로 확인") },
    F4: { score: 1, summary: locked("F4", "특허·qualification barrier 문서") },
    F5: { score: 1, summary: locked("F5", "점유율 또는 bottleneck supplier 근거") },
    F6: { score: 1, summary: locked("F6", "대형 고객 Repeat PO / 양산 (10-Q·IR)") },
    F7: { score: f7, summary: survival.reason },
    F8: { score: f8, summary: f8s },
    F9: { score: 1, summary: locked("F9", "6–24개월 내 인식 전환 이벤트") },
    F10: { score: f10, summary: tenx.reason },
  };

  const factors = FACTOR_ORDER.map((code) => ({
    code,
    score: summary[code].score,
    summary: summary[code].summary,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const filingUrl = `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(quote.ticker)}/financials`;
  const evidences: Evidence[] = [
    {
      id: evId("e"),
      factorCode: "F8",
      evidence: `시가총액 ${formatMoney(marketCap, currency)}, 주가 ${quote.price} ${currency}.`,
      evidenceType: "FACT",
      sourceName: "Market quote",
      sourceUrl: `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(quote.ticker)}`,
      sourceDate: today,
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    },
  ];
  if (rev != null) {
    evidences.push({
      id: evId("e"),
      factorCode: "F2",
      evidence:
        prior != null
          ? `연간 매출 ${formatMoney(prior, currency)} → ${formatMoney(rev, currency)} (${formatPct(growth)}).`
          : `연간 매출 ${formatMoney(rev, currency)}.`,
      evidenceType: "FACT",
      sourceName: "Nasdaq Financials",
      sourceUrl: filingUrl,
      sourceDate: today,
      confidence: 0.85,
      createdAt: new Date().toISOString(),
    });
  }
  if (op != null || cash > 0) {
    evidences.push({
      id: evId("e"),
      factorCode: "F7",
      evidence: `영업손익 ${formatMoney(op, currency)}, 현금(+단기투자) ${formatMoney(cash, currency)}, 부채 ${formatMoney(debt, currency)}.`,
      evidenceType: "FACT",
      sourceName: "Nasdaq Financials",
      sourceUrl: filingUrl,
      sourceDate: today,
      confidence: 0.85,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    quote,
    factors,
    redFlags: flags,
    tenxScenarios: [base, bull],
    requiredRevenue: requiredRevenueFor10x(marketCap, "EV_SALES", 8, 0.12),
    requiredNetIncome: requiredNetIncomeFor10x(marketCap, 25),
    requiredPe: requiredPeFor10x(marketCap, bull.netIncome),
    requiredEvSales: requiredEvSalesFor10x(marketCap, bull.revenue),
    tenxFeasibility: feasibility,
    catalysts: ["실적 발표", "고객/제품 공시", "가이던스 변화"],
    risks: [
      "시장·기술·고객 팩터는 스토리만으로 2점 금지 — 공시 증거 필요",
      "자동 모드 거버넌스 미확인",
      salesMultiple != null && salesMultiple >= 40
        ? "고멀티플: 기대가 이미 가격에 반영"
        : "10x 수학은 가정에 민감",
    ],
    nextProof: [
      f2 < 2 ? "매출 성장 가속 확인" : "대형 고객 Qualification / Repeat PO",
      "10-Q/IR에서 Repeat PO 또는 양산 확인",
      "10x에 필요한 매출 경로를 숫자로 설명",
    ],
    killCriteria: [
      "현금 고갈·대규모 희석",
      "핵심 고객 실패",
      "10x 수학이 더 비현실적으로 악화",
    ],
    thesis: "",
    evidences,
    researchProvider: rev != null ? "filings+heuristic" : "quote+heuristic",
  };
}
