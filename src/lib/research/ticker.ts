import { createServerFn } from "@tanstack/react-start";
import { FACTOR_ORDER, FACTOR_META, type FactorCode } from "../scoring/config";
import { makeFlag, defaultFlags } from "../risk/flags";
import {
  buildScenario,
  defaultScenarios,
  feasibilityFromMath,
  requiredEvSalesFor10x,
  requiredNetIncomeFor10x,
  requiredPeFor10x,
  requiredRevenueFor10x,
} from "../tenx/calculator";
import type {
  Evidence,
  RedFlag,
  ResearchDraft,
  ResearchQuote,
} from "../types";

function heuristicDraft(quote: ResearchQuote): ResearchDraft {
  const { marketCap, financials } = quote;
  const rev = financials.revenueTtm;
  const cash = financials.cash ?? 0;
  const debt = financials.totalDebt ?? 0;
  const op = financials.operatingMargin;

  let f7 = 1;
  let survival: RedFlag = makeFlag("SURVIVAL", "YELLOW", "현금·부채·CFO를 완전 확인하지 못함. 보수적으로 YELLOW.");
  if (op != null && op > 0 && cash >= debt) {
    f7 = 2;
    survival = makeFlag("SURVIVAL", "GREEN", "영업흑자·순현금 성격. 단기 생존 위험 낮음.");
  } else if (cash > 0 && rev && rev > 0 && cash / (rev * 0.2) < 1) {
    f7 = 0;
    survival = makeFlag("SURVIVAL", "RED", "런웨이가 짧을 수 있음. 공시로 재확인 필요.");
  } else if (op != null && op < 0) {
    f7 = 1;
    survival = makeFlag("SURVIVAL", "YELLOW", "영업적자. 12–24개월 런웨이 확인 필요.");
  }

  let f8 = 1;
  let f10 = 1;
  let tenx = makeFlag("TENX", "YELLOW", "10x가 가능하려면 강한 성공 가정이 필요. 자동 모드는 보수적으로 판정.");
  if (marketCap >= 2e11 && quote.currency === "USD") {
    f8 = 0;
    f10 = 0;
    tenx = makeFlag("TENX", "RED", "시총이 이미 커서 10배는 비현실적 매출·멀티플을 요구.");
  } else if (marketCap >= 2e14 && quote.currency === "KRW") {
    f8 = 0;
    f10 = 0;
    tenx = makeFlag("TENX", "RED", "시총이 이미 커서 10배는 비현실적.");
  } else if (marketCap >= 3e10 && quote.currency === "USD") {
    f8 = 0;
    f10 = 1;
    tenx = makeFlag("TENX", "YELLOW", "현재 시총에서 10배는 TAM 확대와 높은 멀티플이 동시에 필요.");
  } else if (marketCap > 0 && marketCap < 1e10 && quote.currency === "USD") {
    f8 = 2;
    f10 = 1;
    tenx = makeFlag("TENX", "GREEN", "시총이 상대적으로 작아 10배 수학의 여지가 있음. 사업 검증은 수동 확인.");
  } else if (quote.currency === "KRW" && marketCap > 0 && marketCap < 1.5e13) {
    f8 = 2;
    f10 = 1;
    tenx = makeFlag("TENX", "GREEN", "시총 대비 10배 여지. 사업 검증은 수동 확인.");
  }

  const { base, bull } = defaultScenarios(marketCap || 1, financials);
  const flags = [
    makeFlag("MANAGEMENT", "YELLOW", "자동 모드는 거버넌스를 확인하지 못함. 공시·IR을 직접 볼 것."),
    survival,
    tenx,
  ];
  const f10eff = f10;
  const feasibility = feasibilityFromMath([base, bull], f10eff, tenx.hardStop);

  const factors = FACTOR_ORDER.map((code) => {
    let score = 1;
    let summary = "UNKNOWN — 자동 수집만으로는 2점을 줄 수 없음.";
    if (code === "F7") {
      score = f7;
      summary = survival.reason;
    } else if (code === "F8") {
      score = f8;
      summary = f8 === 0 ? "현재 시총에 성공이 상당 반영." : f8 === 2 ? "시총 대비 미래 기회 여지." : "적정 수준으로 보수 평가.";
    } else if (code === "F10") {
      score = f10;
      summary = tenx.reason;
    } else if (code === "F2" && rev && marketCap) {
      score = 1;
      summary = `TTM 매출 확인. 성장 가속 여부는 공시 확인 필요.`;
    }
    return { code, score, summary };
  });

  const evidences: Evidence[] = [
    {
      id: `e_${Date.now()}`,
      factorCode: "F8",
      evidence: `시가총액 ${marketCap}, 주가 ${quote.price} ${quote.currency}.`,
      evidenceType: "FACT",
      sourceName: "Yahoo Finance",
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(quote.ticker)}/`,
      sourceDate: new Date().toISOString().slice(0, 10),
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    },
  ];

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
    risks: ["스토리만으로 2점을 준 항목이 있음 — 재검토", "자동 모드 증거 공백", "거버넌스 미확인"],
    nextProof: [
      "매출 성장 가속 확인",
      "대형 고객 Qualification / Repeat PO",
      "10x에 필요한 매출 경로를 숫자로 설명",
    ],
    killCriteria: ["현금 고갈·대규모 희석", "핵심 고객 실패", "10x 수학이 더 비현실적으로 악화"],
    thesis: "",
    evidences,
    researchProvider: "yahoo+heuristic",
  };
}

const GROK_PROMPT = `You are the research engine for Tenbagger Lite, a private wildcard 5% tenbagger discovery terminal.
Score the company for 5–10 year 10x feasibility from TODAY's market cap. Be conservative. Evidence > story.
Do NOT give a factor score of 2 based only on MANAGEMENT_TARGET or INFERENCE.
If you do not know, score 0 or 1 and mark evidence UNKNOWN.
Never invent filings, PO, or customers.

Return ONLY JSON with this shape:
{
  "factors": [{"code":"F1","score":0|1|2,"summary":"...", "evidence":[{"text":"...","type":"FACT|REPORTED|MANAGEMENT_TARGET|INFERENCE","sourceName":"...","sourceUrl":"...","sourceDate":"YYYY-MM-DD","confidence":0.0}]}],
  "redFlags": [{"type":"MANAGEMENT|SURVIVAL|TENX","status":"GREEN|YELLOW|RED","reason":"..."}],
  "catalysts": ["..."],
  "risks": ["..."],
  "nextProof": ["...","...","..."],
  "killCriteria": ["...","...","..."],
  "thesis": "one Korean sentence with concrete numbers answering why this can be 10x",
  "base": {"revenue":0,"operatingMargin":0.2,"netMargin":0.12,"multipleType":"EV_SALES","multipleValue":8},
  "bull": {"revenue":0,"operatingMargin":0.28,"netMargin":0.18,"multipleType":"EV_SALES","multipleValue":12}
}

Factors:
${FACTOR_ORDER.map((c) => `${c} ${FACTOR_META[c].name}: ${FACTOR_META[c].question}`).join("\n")}

Red flags: MANAGEMENT YELLOW=-5 RED=-15; SURVIVAL YELLOW=-10 RED=HARD STOP; TENX YELLOW=-10 RED=HARD STOP
TENX RED means 10x requires industry boom AND perfect execution AND share AND margin AND multiple all at once.
Thesis must include current market cap and a numeric future revenue or earnings path. Korean.`;

type GrokJson = {
  factors?: Array<{
    code?: string;
    score?: number;
    summary?: string;
    evidence?: Array<{
      text?: string;
      type?: string;
      sourceName?: string;
      sourceUrl?: string;
      sourceDate?: string;
      confidence?: number;
    }>;
  }>;
  redFlags?: Array<{ type?: string; status?: string; reason?: string }>;
  catalysts?: string[];
  risks?: string[];
  nextProof?: string[];
  killCriteria?: string[];
  thesis?: string;
  base?: {
    revenue?: number;
    operatingMargin?: number;
    netMargin?: number;
    multipleType?: string;
    multipleValue?: number;
  };
  bull?: {
    revenue?: number;
    operatingMargin?: number;
    netMargin?: number;
    multipleType?: string;
    multipleValue?: number;
  };
};

async function grokResearch(quote: ResearchQuote): Promise<GrokJson | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  const user = [
    `Ticker: ${quote.ticker}`,
    `Name: ${quote.companyName}`,
    `Exchange: ${quote.exchange}`,
    `Country: ${quote.country}`,
    `Sector: ${quote.sector} / ${quote.industry}`,
    `Price: ${quote.price} ${quote.currency}`,
    `Market cap: ${quote.marketCap}`,
    `EV: ${quote.enterpriseValue}`,
    `Financials: ${JSON.stringify(quote.financials)}`,
    `Today: ${new Date().toISOString().slice(0, 10)}`,
  ].join("\n");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.2,
      max_tokens: 3200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: GROK_PROMPT },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(text) as GrokJson;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as GrokJson;
    } catch {
      return null;
    }
  }
}

function mergeGrok(quote: ResearchQuote, grok: GrokJson): ResearchDraft {
  const baseH = heuristicDraft(quote);
  const factorMap = new Map(baseH.factors.map((f) => [f.code, f]));
  const evidences: Evidence[] = [...baseH.evidences];
  if (grok.factors) {
    for (const f of grok.factors) {
      const code = f.code as FactorCode;
      if (!FACTOR_ORDER.includes(code)) continue;
      let score = Math.min(2, Math.max(0, Math.round(Number(f.score) || 0)));
      const evs = f.evidence ?? [];
      const hard = evs.filter(
        (e) => e.type === "FACT" || e.type === "REPORTED",
      );
      if (score === 2 && hard.length === 0) score = 1;
      factorMap.set(code, {
        code,
        score,
        summary: f.summary || factorMap.get(code)?.summary || "UNKNOWN",
      });
      for (const e of evs) {
        if (!e.text) continue;
        evidences.push({
          id: `e_${Math.random().toString(36).slice(2, 9)}`,
          factorCode: code,
          evidence: e.text,
          evidenceType:
            e.type === "FACT" ||
            e.type === "REPORTED" ||
            e.type === "MANAGEMENT_TARGET" ||
            e.type === "INFERENCE"
              ? e.type
              : "INFERENCE",
          sourceName: e.sourceName || "Grok Research",
          sourceUrl: e.sourceUrl || "",
          sourceDate: e.sourceDate || new Date().toISOString().slice(0, 10),
          confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  const flags: RedFlag[] = defaultFlags();
  if (grok.redFlags) {
    for (const rf of grok.redFlags) {
      const type =
        rf.type === "MANAGEMENT" || rf.type === "SURVIVAL" || rf.type === "TENX"
          ? rf.type
          : null;
      const status =
        rf.status === "GREEN" || rf.status === "YELLOW" || rf.status === "RED"
          ? rf.status
          : "YELLOW";
      if (!type) continue;
      const idx = flags.findIndex((f) => f.flagType === type);
      const made = makeFlag(type, status, rf.reason || flags[idx].reason);
      flags[idx] = made;
    }
  }

  const mt = (v: string | undefined): "PE" | "EV_SALES" =>
    v === "PE" ? "PE" : "EV_SALES";
  const base = grok.base
    ? buildScenario({
        scenario: "BASE",
        revenue: Number(grok.base.revenue) || baseH.tenxScenarios[0].revenue,
        operatingMargin: Number(grok.base.operatingMargin) || 0.18,
        netMargin: Number(grok.base.netMargin) || 0.12,
        multipleType: mt(grok.base.multipleType),
        multipleValue: Number(grok.base.multipleValue) || 8,
        currentMarketCap: quote.marketCap,
      })
    : baseH.tenxScenarios[0];
  const bull = grok.bull
    ? buildScenario({
        scenario: "BULL",
        revenue: Number(grok.bull.revenue) || baseH.tenxScenarios[1].revenue,
        operatingMargin: Number(grok.bull.operatingMargin) || 0.28,
        netMargin: Number(grok.bull.netMargin) || 0.2,
        multipleType: mt(grok.bull.multipleType),
        multipleValue: Number(grok.bull.multipleValue) || 12,
        currentMarketCap: quote.marketCap,
      })
    : baseH.tenxScenarios[1];

  const f10 = factorMap.get("F10")?.score ?? 1;
  const tenxRed = flags.some((f) => f.flagType === "TENX" && f.hardStop);

  return {
    quote,
    factors: FACTOR_ORDER.map((c) => factorMap.get(c)!),
    redFlags: flags,
    tenxScenarios: [base, bull],
    requiredRevenue: requiredRevenueFor10x(quote.marketCap, "EV_SALES", 8, 0.12),
    requiredNetIncome: requiredNetIncomeFor10x(quote.marketCap, 25),
    requiredPe: requiredPeFor10x(quote.marketCap, bull.netIncome),
    requiredEvSales: requiredEvSalesFor10x(quote.marketCap, bull.revenue),
    tenxFeasibility: feasibilityFromMath([base, bull], f10, tenxRed),
    catalysts: (grok.catalysts ?? baseH.catalysts).slice(0, 5),
    risks: (grok.risks ?? baseH.risks).slice(0, 5),
    nextProof: (grok.nextProof ?? baseH.nextProof).slice(0, 3),
    killCriteria: (grok.killCriteria ?? baseH.killCriteria).slice(0, 3),
    thesis: grok.thesis ?? "",
    evidences,
    researchProvider: "grok-4.5",
  };
}

export const researchTicker = createServerFn({ method: "POST" })
  .validator((input: { ticker: string; useAi: boolean }) => input)
  .handler(async ({ data }): Promise<
    | { ok: true; draft: ResearchDraft }
    | { ok: false; error: string }
  > => {
    const { candidatesFor, resolveQuote } = await import("./quote-fetch");
    const list = candidatesFor(data.ticker);
    if (list.length === 0) return { ok: false, error: "INVALID TICKER" };

    let quote: ResearchQuote | null = null;
    for (const t of list) {
      quote = await resolveQuote(t);
      if (quote && quote.price) break;
      quote = null;
    }
    if (!quote) return { ok: false, error: "INVALID TICKER" };
    if (!quote.marketCap) {
      return {
        ok: false,
        error: "시가총액을 확인하지 못했습니다. Manual Mode에서 직접 입력하세요.",
      };
    }

    if (data.useAi) {
      try {
        const grok = await grokResearch(quote);
        if (grok) return { ok: true, draft: mergeGrok(quote, grok) };
      } catch {
        // fall through to heuristic
      }
    }
    return { ok: true, draft: heuristicDraft(quote) };
  });
