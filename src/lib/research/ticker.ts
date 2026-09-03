import { createServerFn } from "@tanstack/react-start";
import { FACTOR_ORDER, FACTOR_META, type FactorCode } from "../scoring/config";
import { makeFlag, defaultFlags } from "../risk/flags";
import {
  buildScenario,
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
import { heuristicDraft } from "./heuristic";

const GROK_PROMPT = `You are the research engine for Tenbagger Lite, a private wildcard 5% tenbagger discovery terminal.
Score the company for 5–10 year 10x feasibility from TODAY's market cap. Be conservative. Evidence > story.
You MAY score a factor 2 only when you attach at least one FACT or REPORTED evidence item with a real sourceName (Nasdaq financials, 10-K, 10-Q, IR).
The financials in the user message are FACT from public filings/Nasdaq. Use them for F2, F7, F8, F10.
Do NOT give 2 based only on MANAGEMENT_TARGET or INFERENCE.
Do NOT invent filings, purchase orders, or customers. If unknown, score 0 or 1 and say what proof would unlock 2.
Korean summaries.

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
