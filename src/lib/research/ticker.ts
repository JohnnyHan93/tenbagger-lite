import { createServerFn } from "@tanstack/react-start";
import { FACTOR_ORDER, FACTOR_META, snapEvenScore, type FactorCode } from "../scoring/config";
import { makeFlag, defaultFlags } from "../risk/flags";
import {
  buildScenario,
  buildTenxMath,
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
import { heuristicDraft, stampEvidence } from "./heuristic";
import { packText, type ResearchPack } from "./pack";

const GROK_PROMPT = `You are the Tenbagger / Wildcard research agent.
Goal: score whether THIS market cap can become 5–10x in 5–7 years. Not "is this a good company".
Score ALL 10 factors using ONLY 0 / 2 / 4 / 6 / 8 / 10. No other numbers. No guessing mid-points.
The user message is the research pack (filings, profile, wiki, news). Treat those as FACT or REPORTED.
Do NOT invent TAM, POs, customers, or filings. If unknown, use null score (N/A) and Low confidence — never fake a 0.
You MAY score 8 or 10 only with FACT or REPORTED evidence that has sourceName and sourceUrl.
MOU / pilot / sample ≠ customer validation ≥ 6.
Do not double-count the same fact across factors.
Korean summaries. Return ONLY JSON:
{
  "factors": [{"code":"F1","score":0|2|4|6|8|10|null,"confidence":"High|Medium|Low","summary":"...","evidence":[{"text":"...","type":"FACT|REPORTED|MANAGEMENT_TARGET|INFERENCE","sourceName":"...","sourceUrl":"...","sourceDate":"YYYY-MM-DD","confidence":0.0}]}],
  "redFlags": [{"type":"MANAGEMENT|SURVIVAL|TENX","status":"GREEN|YELLOW|RED","reason":"..."}],
  "catalysts": ["..."],
  "risks": ["..."],
  "nextProof": ["...","...","..."],
  "killCriteria": ["...","...","..."],
  "quarterlyKpis": ["...","...","...","..."],
  "thesis": "one Korean sentence with current market cap and a numeric 10x path",
  "bear": {"revenue":0,"operatingMargin":0.08,"netMargin":0.05,"multipleType":"EV_SALES","multipleValue":4},
  "base": {"revenue":0,"operatingMargin":0.18,"netMargin":0.12,"multipleType":"EV_SALES","multipleValue":8},
  "bull": {"revenue":0,"operatingMargin":0.28,"netMargin":0.18,"multipleType":"EV_SALES","multipleValue":12}
}

Anchors:
${FACTOR_ORDER.map((c) => `${c} w${FACTOR_META[c].weight} ${FACTOR_META[c].name}: ${FACTOR_META[c].question}`).join("\n")}

Hard gates (do not hide): 10x Math < 6 FAIL; Financial Survival < 4 FAIL; Customer Validation < 4 WATCHLIST ONLY.
Every factor F1–F10 MUST appear. 10x Math must not rely on extreme multiple expansion.`;

type GrokJson = {
  factors?: Array<{
    code?: string;
    score?: number | null;
    summary?: string;
    confidence?: string;
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
  quarterlyKpis?: string[];
  bear?: {
    revenue?: number;
    operatingMargin?: number;
    netMargin?: number;
    multipleType?: string;
    multipleValue?: number;
  };
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
      max_tokens: 6000,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: GROK_PROMPT },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(90000),
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
  const evidences: Evidence[] = [...baseH.evidences].map(stampEvidence);
  if (grok.factors) {
    for (const f of grok.factors) {
      const code = f.code as FactorCode;
      if (!FACTOR_ORDER.includes(code)) continue;
      let score = snapEvenScore(f.score);
      const evs = f.evidence ?? [];
      const hard = evs.filter(
        (e) => e.type === "FACT" || e.type === "REPORTED",
      );
      if (score != null && score >= 8 && hard.length === 0) score = 6;
      const prev = factorMap.get(code);
      const conf =
        f.confidence === "High" || f.confidence === "Medium" || f.confidence === "Low"
          ? f.confidence
          : prev?.confidence;
      factorMap.set(code, {
        code,
        score,
        summary: f.summary || prev?.summary || "N/A",
        found: prev?.found,
        benchmark: prev?.benchmark,
        confidence: conf,
      });
      for (const e of evs) {
        if (!e.text) continue;
        evidences.push(
          stampEvidence({
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
          }),
        );
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
  const byName = (n: "BEAR" | "BASE" | "BULL") =>
    baseH.tenxScenarios.find((s) => s.scenario === n);
  const bear = grok.bear
    ? buildScenario({
        scenario: "BEAR",
        revenue: Number(grok.bear.revenue) || byName("BEAR")?.revenue || 0,
        operatingMargin: Number(grok.bear.operatingMargin) || 0.08,
        netMargin: Number(grok.bear.netMargin) || 0.05,
        multipleType: mt(grok.bear.multipleType),
        multipleValue: Number(grok.bear.multipleValue) || 4,
        currentMarketCap: quote.marketCap,
      })
    : byName("BEAR") ?? baseH.tenxScenarios[0]!;
  const base = grok.base
    ? buildScenario({
        scenario: "BASE",
        revenue: Number(grok.base.revenue) || byName("BASE")?.revenue || 0,
        operatingMargin: Number(grok.base.operatingMargin) || 0.18,
        netMargin: Number(grok.base.netMargin) || 0.12,
        multipleType: mt(grok.base.multipleType),
        multipleValue: Number(grok.base.multipleValue) || 8,
        currentMarketCap: quote.marketCap,
      })
    : byName("BASE") ?? baseH.tenxScenarios[1]!;
  const bull = grok.bull
    ? buildScenario({
        scenario: "BULL",
        revenue: Number(grok.bull.revenue) || byName("BULL")?.revenue || 0,
        operatingMargin: Number(grok.bull.operatingMargin) || 0.28,
        netMargin: Number(grok.bull.netMargin) || 0.2,
        multipleType: mt(grok.bull.multipleType),
        multipleValue: Number(grok.bull.multipleValue) || 12,
        currentMarketCap: quote.marketCap,
      })
    : byName("BULL") ?? baseH.tenxScenarios[2]!;

  const f10 = factorMap.get("F10")?.score ?? 4;
  const tenxRed = flags.some((f) => f.flagType === "TENX" && f.hardStop);
  const scenarios = [bear, base, bull];

  return {
    quote,
    factors: FACTOR_ORDER.map((c) => factorMap.get(c)!),
    redFlags: flags,
    tenxScenarios: scenarios,
    tenxMath: buildTenxMath(quote.marketCap, quote.financials, scenarios),
    requiredRevenue: requiredRevenueFor10x(quote.marketCap, "EV_SALES", 8, 0.12),
    requiredNetIncome: requiredNetIncomeFor10x(quote.marketCap, 25),
    requiredPe: requiredPeFor10x(quote.marketCap, bull.netIncome),
    requiredEvSales: requiredEvSalesFor10x(quote.marketCap, bull.revenue),
    tenxFeasibility: feasibilityFromMath(scenarios, f10, tenxRed),
    catalysts: (grok.catalysts ?? baseH.catalysts).slice(0, 5),
    risks: (grok.risks ?? baseH.risks).slice(0, 5),
    nextProof: (grok.nextProof ?? baseH.nextProof).slice(0, 3),
    killCriteria: (grok.killCriteria ?? baseH.killCriteria).slice(0, 3),
    quarterlyKpis: (grok.quarterlyKpis ?? baseH.quarterlyKpis ?? []).slice(0, 4),
    thesis: grok.thesis ?? "",
    evidences,
    findings: baseH.findings,
    researchProvider: "grok-4.5",
  };
}

export async function executeResearch(input: {
  ticker: string;
  useAi: boolean;
}): Promise<{ ok: true; draft: ResearchDraft } | { ok: false; error: string }> {
  const { candidatesFor, resolveQuote } = await import("./quote-fetch.ts");
  const { gatherResearchPack } = await import("./pack.ts");
  const list = candidatesFor(input.ticker);
  if (list.length === 0) return { ok: false, error: "INVALID TICKER" };

  let quote: ResearchQuote | null = null;
  for (const t of list) {
    try {
      quote = await resolveQuote(t);
    } catch {
      quote = null;
    }
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

  let pack: ResearchPack;
  try {
    pack = await gatherResearchPack({
      ticker: quote.ticker,
      companyName: quote.companyName,
      country: quote.country,
    });
  } catch {
    pack = { profile: "", website: "", wiki: "", customers: [], techClaims: [], news: [] };
  }

  const fallback = heuristicDraft(quote, pack);

  if (input.useAi) {
    try {
      const grok = await grokResearch(quote, pack);
      if (grok) return { ok: true, draft: mergeGrok(quote, grok, pack) };
    } catch {
      // provider failure: keep filings+profile draft
    }
  }
  return { ok: true, draft: fallback };
}

export const researchTicker = createServerFn({ method: "POST" })
  .validator((input: { ticker: string; useAi: boolean }) => input)
  .handler(async ({ data }): Promise<
    | { ok: true; draft: ResearchDraft }
    | { ok: false; error: string }
  > => executeResearch(data));

