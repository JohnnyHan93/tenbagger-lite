import { FACTOR_ORDER, type Confidence, type FactorCode } from "../scoring/config.ts";
import { makeFlag } from "../risk/flags.ts";
import {
  buildTenxMath,
  defaultScenarios,
  f10FromMath,
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
import { cagrFromSeries } from "../metrics/derived.ts";
import { numericField, omDeltaFromSeries, pointsOf, seriesTrusted } from "../metrics/series.ts";
import { emptyPack, type ResearchPack } from "./pack.ts";

function evId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function stampEvidence(e: Evidence): Evidence {
  const tier: Evidence["sourceTier"] =
    e.sourceTier ??
    (/nasdaq financials|filing|10-q|10-k|wisereport|dart|ir\b/i.test(e.sourceName)
      ? "TIER_1"
      : /quote|profile|naver/i.test(e.sourceName)
        ? "TIER_2"
        : "TIER_3");
  const engines: NonNullable<Evidence["engineTargets"]> =
    e.engineTargets ??
    (e.factorCode === "F8" || e.factorCode === "F7"
      ? ["xbagger", "oversold", "quality"]
      : e.factorCode === "F2"
        ? ["xbagger", "quality"]
        : ["xbagger"]);
  return {
    ...e,
    statement: e.statement ?? e.evidence,
    sourceTier: tier,
    status: e.status ?? "ACTIVE",
    factorTargets: e.factorTargets ?? [e.factorCode],
    engineTargets: engines,
    retrievedAt: e.retrievedAt ?? e.createdAt,
    asOfDate: e.asOfDate ?? e.sourceDate,
    publishedAt: e.publishedAt ?? e.sourceDate,
  };
}

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
  const series = quote.extras?.series ?? null;
  const cagr3 = cagrFromSeries(series, "revenue", 4);
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
  const requiredRev = marketCap > 0 ? requiredRevenueFor10x(marketCap, "EV_SALES", 8, 0.12) : null;
  const scenarios = defaultScenarios(marketCap, financials);
  const tenxScenarios = scenarios ? [scenarios.bear, scenarios.base, scenarios.bull] : [];
  const tenxMath = buildTenxMath(marketCap, financials, tenxScenarios);

  let f2: Row = {
    score: null,
    summary: "매출 시계열 없음. N/A — 공시 확인 필요.",
    found: "매출 없음",
    benchmark: "10점: YoY 50%+ 또는 30%+ 재가속",
    confidence: "Low",
  };
  if (cagr3 != null) {
    let score = 4;
    if (cagr3 < 0) score = 0;
    else if (cagr3 < 0.05) score = 2;
    else if (cagr3 < 0.12) score = 4;
    else if (cagr3 < 0.2) score = 6;
    else if (cagr3 < 0.35) score = 8;
    else score = 10;
    if (growth != null && growth < 0) score = Math.min(score, 2);
    else if (growth != null && growth < 0.05) score = Math.min(score, 4);
    f2 = {
      score,
      summary: `3Y 매출 CAGR ${formatPct(cagr3)}${growth != null ? ` · YoY ${formatPct(growth)}` : ""}.`,
      found: `CAGR ${formatPct(cagr3)}`,
      benchmark: "10점: 3Y CAGR 35%+",
      confidence: "High",
    };
  } else if (growth != null && rev != null && prior != null) {
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
  }

  let f3: Row = {
    score: null,
    summary: "마진 데이터 없음. N/A.",
    found: "마진 없음",
    benchmark: "8점: 플랫폼/IP + 높은 증분이익",
    confidence: "Low",
  };
  const om = gm != null ? financials.operatingMargin ?? (rev && op != null && rev > 0 ? op / rev : null) : financials.operatingMargin;
  const omDelta = omDeltaFromSeries(series);
  if (gm != null) {
    let score = 4;
    if (gm < 0.1) score = 0;
    else if (gm < 0.2) score = 2;
    else if (gm < 0.35) score = 4;
    else if (gm < 0.55) score = op != null && op > 0 ? 6 : 4;
    else score = op != null && op > 0 ? 8 : 6;
    if (gm >= 0.7 && op != null && op > 0) score = 8;
    if (om != null && om < -0.3) score = Math.min(score, 2);
    if (omDelta != null && omDelta > 0.03 && (op == null || op > 0) && score >= 4) {
      score = Math.min(10, score + 2);
    }
    f3 = {
      score,
      summary:
        op != null && op < 0
          ? `매출총이익률 ${formatPct(gm)}이나 영업적자${om != null ? ` (OM ${formatPct(om)})` : ""}.`
          : `매출총이익률 ${formatPct(gm)}${omDelta != null ? ` · OM Δ ${formatPct(omDelta)}` : ""}.`,
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
  const share =
    blob.match(/(?:market share|점유율|share of)[^0-9%]{0,24}(\d{1,2}(?:\.\d+)?)\s*%/i) ||
    blob.match(/(\d{1,2}(?:\.\d+)?)\s*%[^.]{0,16}(?:market share|점유율)/i);
  const shareN = share ? Number(share[1]) / 100 : null;
  if (shareN != null && Number.isFinite(shareN)) {
    let score = 2;
    if (shareN >= 0.3) score = 8;
    else if (shareN >= 0.15) score = 6;
    else if (shareN >= 0.05) score = 4;
    f5 = {
      score,
      summary: `언급된 점유율 ${formatPct(shareN)}.`,
      found: formatPct(shareN),
      benchmark: "8점: 점유 30%+",
      confidence: "Medium",
    };
  }

  const poHit = pack.news.find((n) =>
    /purchase order|\brepeat\b|production contract|양산|수주/i.test(n.title),
  );
  let f6: Row = {
    score: pack.customers.length ? 4 : null,
    summary: pack.customers.length
      ? `공개 고객: ${pack.customers.join(", ")}. Repeat PO 미확인.`
      : "고객명 없음. 매출만으로 고객 검증하지 않음. N/A.",
    found: pack.customers.length ? pack.customers.slice(0, 3).join(", ") : "고객명 없음",
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

  const cfoVals = seriesTrusted(series) ? numericField(pointsOf(series, "FY"), "cfo").slice(-3) : [];
  const cfoPersist3 = cfoVals.length >= 3 && cfoVals.every((v) => v > 0);
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
  } else if (cfoPersist3 && cash >= debt) {
    f7score = 8;
    f7s = `최근 3FY CFO 흑자 · 순현금. FCF ${formatMoney(fcf, currency)}.`;
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

  let f8score: number | null = null;
  let f8s = "시총/매출 배수 없음. N/A.";
  const f10math = f10FromMath(tenxMath.currentRevenue == null ? null : tenxMath, tenxScenarios);
  const f10score = f10math.score;
  const tenx = makeFlag(
    "TENX",
    f10score == null ? "YELLOW" : f10score >= 6 ? "GREEN" : f10score >= 4 ? "YELLOW" : "RED",
    f10math.reason,
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
  }

  const f8: Row = {
    score: f8score,
    summary: f8s,
    found: salesMultiple != null ? `${salesMultiple.toFixed(0)}x 시총/매출` : formatMoney(marketCap, currency),
    benchmark: "8점: 성장 대비 저평가",
    confidence: f8score == null ? "Low" : salesMultiple != null ? "High" : "Medium",
  };

  const catNews = pack.news.find((n) =>
    /earnings|guidance|launch|contract|FDA|수주|실적|investor day|partnership|world record|ramp|승인/i.test(
      n.title,
    ),
  );
  let f9: Row = {
    score: pack.news.length ? 2 : null,
    summary: pack.news[0] ? `장기 기대/뉴스: ${pack.news[0].title}` : "촉매 공시 없음. N/A.",
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
    summary: f10math.reason,
    found:
      scenarios
        ? `Bull ${scenarios.bull.upsideMultiple.toFixed(1)}x · 필요 매출 ${formatMoney(requiredRev, currency)}`
        : "Tenx math 없음",
    benchmark: "6점: 현실 가정 5–7배 / 10점: Base~Bull로 10배",
    confidence: f10score == null ? "Low" : "High",
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
  const feasibility = feasibilityFromMath(tenxScenarios, f10score, tenx.hardStop);

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
    tenxScenarios,
    tenxMath,
    requiredRevenue: requiredRev,
    requiredNetIncome: requiredNetIncomeFor10x(marketCap, 25),
    requiredPe: scenarios ? requiredPeFor10x(marketCap, scenarios.bull.netIncome) : null,
    requiredEvSales: scenarios ? requiredEvSalesFor10x(marketCap, scenarios.bull.revenue) : null,
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
    evidences: evidences.map(stampEvidence),
    findings,
    researchProvider: pack.profile || rev != null ? "filings+profile" : "quote+heuristic",
  };
}
