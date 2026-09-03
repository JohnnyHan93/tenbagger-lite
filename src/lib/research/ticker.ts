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
import { packText, type ResearchPack } from "./pack";

const GROK_PROMPT = `You are the research engine for Tenbagger Lite, a private wildcard 5% tenbagger discovery terminal.
Score ALL 10 factors for 5–10 year 10x feasibility from TODAY's market cap. Be conservative. Evidence > story.
The user message includes a research pack (Nasdaq financials, company profile, wiki, news). Treat those as FACT or REPORTED.
You MAY use the pack numbers as FACT. Do not call tools.
You MAY score 2 only with FACT or REPORTED evidence that has sourceName and sourceUrl.
Do NOT invent filings, POs, or customers. If unknown, score 0 or 1 and state the unlock condition.
Korean summaries. Return ONLY JSON:
{
  "factors": [{"code":"F1","score":0|1|2,"summary":"...","evidence":[{"text":"...","type":"FACT|REPORTED|MANAGEMENT_TARGET|INFERENCE","sourceName":"...","sourceUrl":"...","sourceDate":"YYYY-MM-DD","confidence":0.0}]}],
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
Every factor F1–F10 MUST appear. Thesis must include current market cap and a numeric future revenue path.`;

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

type ChatBody = {
  choices?: Array<{ message?: { content?: string } }>;
};

function parseGrokJson(text: string): GrokJson | null {
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

async function grokResearch(
  quote: ResearchQuote,
  pack: ResearchPack,
): Promise<GrokJson | null> {
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
    "",
    "Research pack (ONLY source of truth — do not invent names or POs):",
    packText(pack),
    "",
    "Score ALL 10 factors. Compare found value vs the 2-point bar in each summary.",
  ].join("\n");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.15,
      max_tokens: 2800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: GROK_PROMPT },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(28000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as ChatBody;
  return parseGrokJson(body.choices?.[0]?.message?.content ?? "");
}

function mergeGrok(
  quote: ResearchQuote,
  grok: GrokJson,
  pack: ResearchPack,
): ResearchDraft {
  const baseH = heuristicDraft(quote, pack);
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
      const prev = factorMap.get(code);
      factorMap.set(code, {
        code,
        score,
        summary: f.summary || prev?.summary || "UNKNOWN",
        found: prev?.found,
        benchmark: prev?.benchmark,
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
    findings: baseH.findings,
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
    const { gatherResearchPack } = await import("./pack");
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

    const pack = await gatherResearchPack({
      ticker: quote.ticker,
      companyName: quote.companyName,
      country: quote.country,
    });
    const fallback = heuristicDraft(quote, pack);

    if (data.useAi) {
      try {
        const grok = await grokResearch(quote, pack);
        if (grok) return { ok: true, draft: mergeGrok(quote, grok, pack) };
      } catch {
        // fall through
      }
    }
    return { ok: true, draft: fallback };
  });
