import { FACTOR_ORDER, FACTOR_META, type Confidence, type FactorCode } from "../scoring/config.ts";
import { makeFlag } from "../risk/flags.ts";
import {
  buildTenxMath,
  defaultScenarios,
  feasibilityFromMath,
  requiredEvSalesFor10x,
  requiredNetIncomeFor10x,
  requiredPeFor10x,
  requiredRevenueFor10x,
  scoreTenxFromUpside,
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

type Row = {
  score: number | null;
  summary: string;
  found: string;
  benchmark: string;
  confidence: Confidence;
};

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
  const { bear, base, bull } = defaultScenarios(marketCap || 1, financials);
  const tenxMath = buildTenxMath(marketCap || 1, financials, [bear, base, bull]);

  let f2: Row = {
    score: null,
    summary: "매출 시계열 없음. N/A — 공시 확인 필요.",
    found: "매출 없음",
    benchmark: "10점: YoY 50%+ 또는 30%+ 재가속",
    confidence: "Low",
  };
  if (growth != null && rev != null && prior != null) {
    let score = 4;
    if (growth < 0) score = 0;
    else if (growth < 0.05) score = 2;
    else if (growth < 0.15) score = 4;
    else if (growth < 0.3) score = 6;
    else if (growth < 0.5) score = 8;
    else score = 10;
    f2 = {
      score,
      summary: `매출 ${formatMoney(prior, currency)} → ${formatMoney(rev, currency)} (${formatPct(growth)}).`,
      found: formatPct(growth),
      benchmark: "10점: YoY 50%+ / 8점: 30–50%",
      confidence: "High",
    };
  }

  const cagr = blob.match(/CAGR[^0-9]{0,12}(\d{1,2}(?:\.\d+)?)\s*%/i);
  const cagrN = cagr ? Number(cagr[1]) / 100 : null;
  const tamMult = rev && rev > 0 && requiredRev ? requiredRev / rev : null;
  let f1: Row = {
    score: null,
    summary: "TAM·CAGR 외부 숫자 없음. N/A.",
    found: "TAM 없음",
    benchmark: "8점: CAGR 15–25% + TAM 10배+",
    confidence: "Low",
  };
  if (cagrN != null) {
    let score = 4;
    if (cagrN < 0) score = 0;
    else if (cagrN < 0.03) score = 2;
    else if (cagrN < 0.08) score = 4;
    else if (cagrN < 0.15) score = 6;
    else if (cagrN < 0.25) score = 8;
    else score = 10;
    f1 = {
      score,
      summary: `언급된 TAM CAGR ${formatPct(cagrN)}.`,
      found: `TAM CAGR ${formatPct(cagrN)}`,
      benchmark: "8점: CAGR 15–25%",
      confidence: "Medium",
    };
  } else if (growingTheme && (growth == null || growth >= 0.08)) {
    f1 = {
      score: 6,
      summary: `구조 성장 테마(${quote.sector || quote.industry || "profile"}). 외부 TAM 숫자는 없음.`,
      found: `성장 테마 · ${quote.sector || quote.industry || "profile"}`,
      benchmark: "8점: CAGR 15–25% + TAM 10배+",
      confidence: "Medium",
    };
  } else if (!growingTheme && growth != null && growth < 0) {
    f1 = {
      score: 0,
      summary: "시장·매출이 동시에 약함.",
      found: "축소 징후",
      benchmark: "8점: CAGR 15–25%",
      confidence: "Medium",
    };
  }

  let f3: Row = {
    score: null,
    summary: "마진 데이터 없음. N/A.",
    found: "마진 없음",
    benchmark: "8점: 플랫폼/IP + 높은 증분이익",
    confidence: "Low",
  };
  if (gm != null) {
    let score = 4;
    if (gm < 0.1) score = 0;
    else if (gm < 0.2) score = 2;
    else if (gm < 0.35) score = 4;
    else if (gm < 0.55) score = op != null && op > 0 ? 6 : 4;
    else score = op != null && op > 0 ? 8 : 6;
    if (gm >= 0.7 && op != null && op > 0) score = 8;
    f3 = {
      score,
      summary:
        op != null && op < 0
          ? `매출총이익률 ${formatPct(gm)}이나 영업적자.`
          : `매출총이익률 ${formatPct(gm)}.`,
      found: `GPM ${formatPct(gm)}`,
      benchmark: "8점: 높은 증분이익 + 레버리지",
      confidence: "High",
    };
  }

  let f4: Row = {
    score: pack.techClaims.length ? 4 : null,
    summary: pack.techClaims[0] || "해자 문서 없음. N/A.",
    found: pack.techClaims[0] || "해자 문서 없음",
    benchmark: "8점: 복수 moat (특허+락인+인증)",
    confidence: pack.techClaims.length ? "Medium" : "Low",
  };
  if (/world record|patent/i.test(pack.techClaims.join(" "))) {
    f4 = {
      score: pack.customers.length >= 2 ? 8 : 6,
      summary: `${pack.techClaims[0]} ${pack.customers.length ? `고객 ${pack.customers.slice(0, 3).join(", ")}` : ""}`.trim(),
      found: pack.techClaims[0]!,
      benchmark: "8점: 복수 moat",
      confidence: "Medium",
    };
  }

  let f5: Row = {
    score: null,
    summary: "점유율 숫자 없음. N/A.",
    found: "점유율 없음",
    benchmark: "8점: Top 3 또는 빠른 점유 상승",
    confidence: "Low",
  };
  if (/world'?s leading|leader|first commercially/i.test(blob) || pack.customers.length >= 3) {
    f5 = {
      score: 4,
      summary: pack.customers.length
        ? `공개 고객 ${pack.customers.slice(0, 3).join(", ")}. 점유율은 미확인.`
        : "리더 주장. 점유율 숫자 없음.",
      found: pack.customers.length ? `고객 ${pack.customers.length}곳` : "리더 주장",
      benchmark: "8점: Top 3 또는 점유 상승",
      confidence: "Medium",
    };
  }

  const poHit = pack.news.find((n) =>
    /purchase order|\brepeat\b|production contract|양산|수주/i.test(n.title),
  );
  let f6: Row = {
    score: rev && rev > 0 ? 4 : pack.customers.length ? 4 : 2,
    summary: pack.customers.length
      ? `공개 고객: ${pack.customers.join(", ")}. Repeat PO 미확인.`
      : rev && rev > 0
        ? "매출은 있으나 고객명 없음."
        : "고객 증거 약함.",
    found: pack.customers.length ? pack.customers.slice(0, 3).join(", ") : rev ? "매출만 확인" : "고객명 없음",
    benchmark: "6점: 다수 유료+반복 / 8점: 대형 고객 반복",
    confidence: pack.customers.length ? "Medium" : "Low",
  };
  if (poHit && pack.customers.length) {
    f6 = {
      score: 6,
      summary: `${poHit.title} + 고객 ${pack.customers.slice(0, 3).join(", ")}.`,
      found: poHit.title,
      benchmark: "8점: 대형 고객 반복·갱신",
      confidence: "Medium",
    };
  }
  if (!pack.customers.length && !(rev && rev > 0)) {
    f6 = {
      score: 2,
      summary: "MOU/파일럿 이상으로 보기 어려움.",
      found: "고객명 없음",
      benchmark: "6점: 다수 유료+반복",
      confidence: "Low",
    };
  }

  let f7score: number | null = null;
  let f7s = "현금·부채·CFO 미확인. N/A.";
  let f7conf: Confidence = "Low";
  let survival: RedFlag = makeFlag(
    "SURVIVAL",
    "YELLOW",
    "현금·부채·CFO를 완전 확인하지 못함.",
  );
  if (fcf != null && fcf > 0 && cash >= debt) {
    f7score = 10;
    f7s = `FCF 흑자 ${formatMoney(fcf, currency)} · 순현금.`;
    f7conf = "High";
    survival = makeFlag("SURVIVAL", "GREEN", f7s);
  } else if (op != null && op > 0 && cash >= debt) {
    f7score = 8;
    f7s = `영업흑자 ${formatMoney(op, currency)} · 순현금 성격.`;
    f7conf = "High";
    survival = makeFlag("SURVIVAL", "GREEN", f7s);
  } else if (runwayYears != null && runwayYears >= 2) {
    f7score = 6;
    f7s = `영업적자 ${formatMoney(op, currency)}. 현금 런웨이 약 ${runwayYears.toFixed(1)}년.`;
    f7conf = "High";
    survival = makeFlag("SURVIVAL", "YELLOW", f7s);
  } else if (runwayYears != null && runwayYears >= 1.5) {
    f7score = 4;
    f7s = `런웨이 약 ${runwayYears.toFixed(1)}년. 자본조달 가능성.`;
    f7conf = "High";
    survival = makeFlag("SURVIVAL", "YELLOW", f7s);
  } else if (runwayYears != null && runwayYears >= 1) {
    f7score = 2;
    f7s = `런웨이 약 ${runwayYears.toFixed(1)}년. 반복 증자 위험.`;
    f7conf = "High";
    survival = makeFlag("SURVIVAL", "YELLOW", f7s);
  } else if (runwayYears != null && runwayYears < 1) {
    f7score = 0;
    f7s = `런웨이 약 ${runwayYears.toFixed(1)}년. 유동성 위기 가능.`;
    f7conf = "High";
    survival = makeFlag("SURVIVAL", "RED", f7s);
  } else if (cash > 0 || op != null) {
    f7score = 4;
    f7s = `현금 ${formatMoney(cash, currency)} · 영업손익 ${formatMoney(op, currency)}. 런웨이 추정 불완전.`;
    f7conf = "Medium";
    survival = makeFlag("SURVIVAL", "YELLOW", f7s);
  }
  const f7: Row = {
    score: f7score,
    summary: f7s,
    found: runwayYears != null ? `런웨이 ${runwayYears.toFixed(1)}년` : op != null ? formatMoney(op, currency) : "현금/손익 없음",
    benchmark: "8점: 순현금 + CFO/FCF 흑자",
    confidence: f7conf,
  };

  let f8score: number | null = 4;
  let f8s = "적정 수준으로 보수 평가.";
  let f10score = scoreTenxFromUpside(bull.upsideMultiple, base.upsideMultiple);
  let tenx = makeFlag(
    "TENX",
    f10score >= 6 ? "GREEN" : f10score >= 4 ? "YELLOW" : "RED",
    `Bull ${bull.upsideMultiple.toFixed(1)}x · Base ${base.upsideMultiple.toFixed(1)}x. 경로 ${tenxMath.path}.`,
  );

  if (marketCap >= 2e11 && currency === "USD") {
    f8score = 0;
    f8s = "시총이 이미 커서 미래가 상당 반영.";
  } else if (marketCap >= 2e14 && currency === "KRW") {
    f8score = 0;
    f8s = "시총이 이미 커서 10배는 비현실적.";
  } else if (salesMultiple != null && salesMultiple >= 40) {
    f8score = 0;
    f8s = `시총/매출 ${salesMultiple.toFixed(0)}x. 성공이 이미 가격에 반영.`;
  } else if (salesMultiple != null && salesMultiple >= 20) {
    f8score = 2;
    f8s = `시총/매출 ${salesMultiple.toFixed(0)}x. 성장의 상당 부분 반영.`;
  } else if (salesMultiple != null && salesMultiple >= 8) {
    f8score = 4;
    f8s = `시총/매출 ${salesMultiple.toFixed(1)}x. 고성장으로 일부 정당화.`;
  } else if (salesMultiple != null && salesMultiple < 8) {
    f8score = 8;
    f8s = `시총/매출 ${salesMultiple.toFixed(1)}x. 성장 대비 여지.`;
  } else if (marketCap > 0 && marketCap < 1e10 && currency === "USD") {
    f8score = 6;
    f8s = "시총 대비 미래 기회 여지.";
  } else if (currency === "KRW" && marketCap > 0 && marketCap < 1.5e13) {
    f8score = 6;
    f8s = "시총 대비 미래 기회 여지.";
  }

  const f8: Row = {
    score: f8score,
    summary: f8s,
    found: salesMultiple != null ? `${salesMultiple.toFixed(0)}x 시총/매출` : formatMoney(marketCap, currency),
    benchmark: "8점: 성장 대비 저평가",
    confidence: salesMultiple != null ? "High" : "Medium",
  };

  const catNews = pack.news.find((n) =>
    /earnings|guidance|launch|contract|FDA|수주|실적|investor day|partnership|world record|ramp|승인/i.test(
      n.title,
    ),
  );
  let f9: Row = {
    score: pack.news.length ? 2 : 0,
    summary: pack.news[0] ? `장기 기대/뉴스: ${pack.news[0].title}` : "명확한 촉매 없음.",
    found: catNews?.title || pack.news[0]?.title || "촉매 없음",
    benchmark: "8점: 12–24개월 실적 반영 복수 촉매",
    confidence: pack.news.length ? "Medium" : "Low",
  };
  if (catNews) {
    f9 = {
      score: 4,
      summary: `촉매 후보: ${catNews.title}`,
      found: catNews.title,
      benchmark: "8점: 복수 촉매·일정",
      confidence: "Medium",
    };
  }

  const f10: Row = {
    score: f10score,
    summary: tenx.reason,
    found: `Bull ${bull.upsideMultiple.toFixed(1)}x · 필요 매출 ${formatMoney(requiredRev, currency)}`,
    benchmark: "6점: 현실 가정 5–7배 / 10점: Base~Bull로 10배",
    confidence: rev != null ? "High" : "Medium",
  };

  void tamMult;
  const flags = [
    makeFlag(
      "MANAGEMENT",
      "YELLOW",
      "자동 모드는 거버넌스·희석(ATM/CB/워런트)을 확인하지 못함.",
    ),
    survival,
    tenx,
  ];
  const feasibility = feasibilityFromMath([bear, base, bull], f10score, tenx.hardStop);

  const summary: Record<FactorCode, Row> = {
    F1: f1,
    F2: f2,
    F3: f3,
    F4: f4,
    F5: f5,
    F6: f6,
    F7: f7,
    F8: f8,
    F9: f9,
    F10: f10,
  };

  const factors = FACTOR_ORDER.map((code) => ({
    code,
    score: summary[code].score,
    summary: summary[code].summary,
    found: summary[code].found,
    benchmark: summary[code].benchmark,
    confidence: summary[code].confidence,
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
    { label: "10x 경로", value: tenxMath.path },
    requiredRev
      ? { label: "10x 필요 매출", value: formatMoney(requiredRev, currency) }
      : null,
  ].filter((x): x is { label: string; value: string } => x != null);

  const kpis = [
    "다음 분기 매출 YoY",
    f6.score != null && f6.score < 6 ? "Repeat PO / 갱신율" : "고객당 매출",
    runwayYears != null && runwayYears < 3 ? "현금 소진·희석" : "FCF 추세",
    "가이던스 vs 실제",
  ];

  return {
    quote,
    factors,
    redFlags: flags,
    tenxScenarios: [bear, base, bull],
    tenxMath,
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
        : "고객 검증 전 단계",
      "자동 모드 거버넌스·희석 미확인",
      salesMultiple != null && salesMultiple >= 40
        ? "고멀티플: 기대가 이미 가격에 반영"
        : "10x 수학은 가정에 민감",
    ],
    nextProof: [
      f6.score != null && f6.score < 6 ? "10-Q/IR에서 Repeat PO 또는 양산" : "매출 성장 지속",
      "외부 검증 TAM/SAM",
      "희석(ATM/CB/워런트) 없음 확인",
    ],
    killCriteria: [
      "현금 고갈·대규모 희석",
      "핵심 고객 실패",
      "10x 수학이 더 비현실적으로 악화",
    ],
    quarterlyKpis: kpis,
    thesis: "",
    evidences,
    findings,
    researchProvider: pack.profile || rev != null ? "filings+profile" : "quote+heuristic",
  };
}
