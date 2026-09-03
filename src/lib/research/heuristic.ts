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
import { emptyPack, type ResearchPack } from "./pack.ts";

function evId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const GROWING =
  /quantum|semiconductor|robot|aerospace|space\b|artificial intelligence|\bai\b|cyber|biotech|electric vehicle|\bev\b|data center|foundry|photonic|networking|defense/i;

export function heuristicDraft(
  quote: ResearchQuote,
  pack: ResearchPack = emptyPack(),
): ResearchDraft {
  const { marketCap, financials, currency } = quote;
  const rev = financials.revenueTtm;
  const prior = financials.revenuePrior;
  const cash = financials.cash ?? 0;
  const debt = financials.totalDebt ?? 0;
  const op = financials.operatingIncomeTtm;
  const fcf = financials.fcf;
  const gm = financials.grossMargin;
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
  const blob = `${pack.profile}\n${pack.wiki}\n${quote.sector}\n${quote.industry}`;
  const growingTheme = GROWING.test(blob);
  const requiredRev = requiredRevenueFor10x(marketCap, "EV_SALES", 8, 0.12);

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
      f2s = `매출 성장 ${formatPct(growth)}로 완만.`;
    }
  }

  let f1 = 1;
  let f1s = `${FACTOR_META.F1.nameKo} — 구조 성장 근거 부족. 2점 조건: TAM CAGR ≥15% 공시/리서치.`;
  const cagr = blob.match(/CAGR[^0-9]{0,12}(\d{1,2}(?:\.\d+)?)\s*%/i);
  const cagrN = cagr ? Number(cagr[1]) / 100 : null;
  if (cagrN != null && cagrN >= 0.15) {
    f1 = 2;
    f1s = `언급된 TAM CAGR ${formatPct(cagrN)}. 구조 성장 근거.`;
  } else if (growingTheme && (growth == null || growth >= 0.15)) {
    f1 = 1;
    f1s = `성장 테마(${quote.sector || quote.industry || "profile"})와 사업 설명이 맞음. 2점은 TAM 숫자.`;
  } else if (!growingTheme && growth != null && growth < 0) {
    f1 = 0;
    f1s = "시장·매출이 동시에 약함.";
  }

  let f3 = 1;
  let f3s = `${FACTOR_META.F3.nameKo} — 마진 데이터 부족.`;
  if (gm != null && gm >= 0.55 && op != null && op > 0) {
    f3 = 2;
    f3s = `매출총이익률 ${formatPct(gm)} · 영업흑자. 레버리지 확인.`;
  } else if (gm != null && gm >= 0.3) {
    f3 = 1;
    f3s =
      op != null && op < 0
        ? `매출총이익률 ${formatPct(gm)}이나 영업적자. 확장성은 미완성.`
        : `매출총이익률 ${formatPct(gm)}. 영업 레버리지 추가 확인.`;
  } else if (gm != null && gm < 0.15) {
    f3 = 0;
    f3s = `매출총이익률 ${formatPct(gm)}. 한계이익이 약함.`;
  }

  let f4 = 1;
  let f4s = `${FACTOR_META.F4.nameKo} — 해자 문서 없음. 2점 조건: 특허·qualification.`;
  if (pack.techClaims.length) {
    f4 = 1;
    f4s = pack.techClaims[0]!;
    if (/world record|patent/i.test(pack.techClaims.join(" ")) && pack.customers.length >= 2) {
      f4 = 2;
      f4s = `${pack.techClaims[0]} 고객 ${pack.customers.slice(0, 3).join(", ")}가 사용.`;
    }
  }

  let f5 = 1;
  let f5s = `${FACTOR_META.F5.nameKo} — 점유율 숫자 없음.`;
  if (/world'?s leading|leader|first commercially/i.test(blob)) {
    f5 = 1;
    f5s = "사업 설명이 리더를 주장. 2점은 점유율·bottleneck 숫자.";
  }
  if (pack.customers.length >= 3) {
    f5 = 1;
    f5s = `공개 고객 ${pack.customers.slice(0, 3).join(", ")}. 점유율은 미확인.`;
  }

  let f6 = 1;
  let f6s = `${FACTOR_META.F6.nameKo} — 고객명 없음. 2점 조건: Repeat PO / 양산.`;
  if (pack.customers.length >= 2) {
    f6 = 1;
    f6s = `공개 고객: ${pack.customers.join(", ")}. Repeat PO는 미확인.`;
  }
  const poHit = pack.news.find((n) =>
    /purchase order|\brepeat\b|production contract|양산|수주/i.test(n.title),
  );
  if (poHit && pack.customers.length) {
    f6 = 2;
    f6s = `${poHit.title} + 고객 ${pack.customers.slice(0, 3).join(", ")}.`;
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
      `고멀티플 상태. 10배는 매출 ${formatMoney(requiredRev, currency)} 경로가 필요.`,
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

  let f9 = 1;
  let f9s = `${FACTOR_META.F9.nameKo} — 6–24개월 촉매 미확인.`;
  const catNews = pack.news.find((n) =>
    /earnings|guidance|launch|contract|FDA|수주|실적|investor day|partnership|world record/i.test(
      n.title,
    ),
  );
  if (catNews) {
    f9 = 1;
    f9s = `촉매 후보: ${catNews.title}`;
  } else if (pack.news.length) {
    f9 = 1;
    f9s = `최근 뉴스: ${pack.news[0]!.title}`;
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

  const summary: Record<
    FactorCode,
    { score: number; summary: string; found: string; benchmark: string }
  > = {
    F1: {
      score: f1,
      summary: f1s,
      found: cagrN != null ? `TAM CAGR ${formatPct(cagrN)}` : growingTheme ? `성장 테마 · ${quote.sector || quote.industry || "profile"}` : "구조 성장 근거 없음",
      benchmark: "2점: TAM CAGR ≥15%",
    },
    F2: {
      score: f2,
      summary: f2s,
      found: growth != null ? formatPct(growth) : "매출 없음",
      benchmark: "2점: YoY ≥+40%",
    },
    F3: {
      score: f3,
      summary: f3s,
      found: gm != null ? `GPM ${formatPct(gm)}` : "마진 없음",
      benchmark: "2점: GPM ≥55% + 영업흑자",
    },
    F4: {
      score: f4,
      summary: f4s,
      found: pack.techClaims[0] || "해자 문서 없음",
      benchmark: "2점: 특허/기록 + 고객 2곳+",
    },
    F5: {
      score: f5,
      summary: f5s,
      found: pack.customers.length ? `고객 ${pack.customers.length}곳` : "점유율 없음",
      benchmark: "2점: 점유율 또는 bottleneck 숫자",
    },
    F6: {
      score: f6,
      summary: f6s,
      found: pack.customers.length ? pack.customers.slice(0, 3).join(", ") : "고객명 없음",
      benchmark: "2점: Repeat PO / 양산 공시",
    },
    F7: {
      score: f7,
      summary: survival.reason,
      found: runwayYears != null ? `런웨이 ${runwayYears.toFixed(1)}년` : op != null ? formatMoney(op, currency) : "현금/손익 없음",
      benchmark: "2점: 영업흑자 + 순현금",
    },
    F8: {
      score: f8,
      summary: f8s,
      found: salesMultiple != null ? `${salesMultiple.toFixed(0)}x 시총/매출` : formatMoney(marketCap, currency),
      benchmark: "2점: 시총/매출 <8x 이고 시총 작음",
    },
    F9: {
      score: f9,
      summary: f9s,
      found: catNews?.title || pack.news[0]?.title || "촉매 없음",
      benchmark: "2점: 6–24개월 인식 전환 이벤트",
    },
    F10: {
      score: f10,
      summary: tenx.reason,
      found: requiredRev ? `10x 필요 매출 ${formatMoney(requiredRev, currency)}` : "수학 불가",
      benchmark: "2점: 보수 가정으로 10x 설명",
    },
  };

  const factors = FACTOR_ORDER.map((code) => ({
    code,
    score: summary[code].score,
    summary: summary[code].summary,
    found: summary[code].found,
    benchmark: summary[code].benchmark,
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
  if (pack.profile) {
    evidences.push({
      id: evId("e"),
      factorCode: "F4",
      evidence: pack.profile.slice(0, 360),
      evidenceType: "REPORTED",
      sourceName: "Nasdaq Company Profile",
      sourceUrl: `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(quote.ticker)}/company-profile`,
      sourceDate: today,
      confidence: 0.7,
      createdAt: new Date().toISOString(),
    });
  }
  if (pack.customers.length) {
    evidences.push({
      id: evId("e"),
      factorCode: "F6",
      evidence: `공개 고객: ${pack.customers.join(", ")}`,
      evidenceType: "REPORTED",
      sourceName: "Company profile",
      sourceUrl: pack.website || filingUrl,
      sourceDate: today,
      confidence: 0.65,
      createdAt: new Date().toISOString(),
    });
  }
  for (const n of pack.news.slice(0, 3)) {
    evidences.push({
      id: evId("e"),
      factorCode: "F9",
      evidence: n.title,
      evidenceType: "REPORTED",
      sourceName: "News",
      sourceUrl: n.url,
      sourceDate: n.date || today,
      confidence: 0.55,
      createdAt: new Date().toISOString(),
    });
  }

  const findings = [
    growth != null ? { label: "매출 성장", value: formatPct(growth) } : null,
    gm != null ? { label: "매출총이익률", value: formatPct(gm) } : null,
    salesMultiple != null
      ? { label: "시총/매출", value: `${salesMultiple.toFixed(0)}x` }
      : null,
    runwayYears != null
      ? { label: "현금 런웨이", value: `${runwayYears.toFixed(1)}년` }
      : null,
    pack.customers.length
      ? { label: "공개 고객", value: pack.customers.slice(0, 3).join(", ") }
      : null,
    requiredRev
      ? { label: "10x 필요 매출", value: formatMoney(requiredRev, currency) }
      : null,
  ].filter((x): x is { label: string; value: string } => x != null);

  return {
    quote,
    factors,
    redFlags: flags,
    tenxScenarios: [base, bull],
    requiredRevenue: requiredRev,
    requiredNetIncome: requiredNetIncomeFor10x(marketCap, 25),
    requiredPe: requiredPeFor10x(marketCap, bull.netIncome),
    requiredEvSales: requiredEvSalesFor10x(marketCap, bull.revenue),
    tenxFeasibility: feasibility,
    catalysts: pack.news.slice(0, 5).map((n) => n.title).concat(
      pack.news.length ? [] : ["실적 발표", "고객/제품 공시", "가이던스 변화"],
    ).slice(0, 5),
    risks: [
      pack.customers.length
        ? "고객은 공개됐지만 Repeat PO·양산은 별도 확인"
        : "시장·기술·고객 팩터는 스토리만으로 2점 금지",
      "자동 모드 거버넌스 미확인",
      salesMultiple != null && salesMultiple >= 40
        ? "고멀티플: 기대가 이미 가격에 반영"
        : "10x 수학은 가정에 민감",
    ],
    nextProof: [
      f6 < 2 ? "10-Q/IR에서 Repeat PO 또는 양산 확인" : "매출 성장 지속 확인",
      "TAM CAGR 3rd-party 숫자",
      "10x에 필요한 매출 경로를 숫자로 설명",
    ],
    killCriteria: [
      "현금 고갈·대규모 희석",
      "핵심 고객 실패",
      "10x 수학이 더 비현실적으로 악화",
    ],
    thesis: "",
    evidences,
    findings,
    researchProvider: pack.profile || rev != null ? "filings+profile" : "quote+heuristic",
  };
}
