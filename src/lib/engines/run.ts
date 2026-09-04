import { heuristicDraft } from "../research/heuristic.ts";
import { emptyPack, type ResearchPack } from "../research/pack.ts";
import { lookupIdentity } from "../research/identity.ts";
import type { Company, ResearchDraft, ResearchQuote } from "../types.ts";
import { uid } from "../utils.ts";
import { deriveMetrics } from "../metrics/derived.ts";
import { industryGroupOf } from "./industry.ts";
import { scoreXBagger } from "./xbagger.ts";
import { scoreOversold } from "./oversold.ts";
import { scoreQuality } from "./quality.ts";
import { scoreLenses } from "./lenses.ts";
import { researchPriority, strategyTags } from "./matrix.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import type { FactorCode } from "../scoring/config.ts";
import type { AdapterName } from "../research/identity.ts";

function finishSnapshot(input: {
  company: Company;
  quote: ResearchQuote;
  draft: ResearchDraft;
  asOf?: string;
  researchPriorityOn?: boolean;
  extras?: Parameters<typeof deriveMetrics>[0]["extras"];
}): Snapshot {
  const asOf = input.asOf ?? new Date().toISOString();
  const ident = lookupIdentity(input.quote.ticker) ?? lookupIdentity(input.company.ticker);
  const group =
    ident?.group ??
    industryGroupOf(
      input.quote.sector || input.company.sector,
      input.quote.industry || input.company.industry,
    );
  const adapter: AdapterName =
    ident?.adapter ??
    (group === "saas"
      ? "Software"
      : group === "semi"
        ? "Semiconductor"
        : group === "healthcare"
          ? "Healthcare"
          : group === "financial"
            ? "Financial"
            : group === "reit"
              ? "REIT"
              : group === "pharma"
                ? "Biotech"
                : group === "industrial"
                  ? "Industrial"
                  : "Other");
  const derived = deriveMetrics({
    price: input.quote.price,
    marketCap: input.quote.marketCap,
    enterpriseValue: input.quote.enterpriseValue,
    financials: input.quote.financials,
    industryGroup: group,
    extras: {
      high52w: input.quote.high52w ?? null,
      pb: input.quote.pb ?? null,
      assets: input.quote.extras?.assets ?? null,
      capex: input.quote.extras?.capex ?? null,
      cfo: input.quote.extras?.cfo ?? null,
      roic: input.quote.extras?.roic ?? null,
      drawdown52w: input.quote.extras?.drawdown52w ?? null,
      opPrior: input.quote.extras?.opPrior ?? null,
      omChange: input.quote.extras?.omChange ?? null,
      nm: input.quote.extras?.nm ?? null,
      ...input.extras,
    },
  });

  let x;
  try {
    x = scoreXBagger({
      factors: input.draft.factors.map((f) => ({
        code: f.code as FactorCode,
        score: f.score,
        reason: f.summary,
        confidence: f.confidence,
        evidenceIds: input.draft.evidences.filter((e) => e.factorCode === f.code).map((e) => e.id),
      })),
      tenxMath: input.draft.tenxMath ?? null,
      tenxScenarios: input.draft.tenxScenarios,
      tenxFeasibility: input.draft.tenxFeasibility,
      trustFail: input.draft.redFlags.some((f) => f.flagType === "MANAGEMENT" && f.hardStop),
    });
  } catch {
    x = scoreXBagger({
      factors: input.draft.factors.map((f) => ({
        code: f.code as FactorCode,
        score: null,
        reason: "X-Bagger provider error — N/A",
      })),
      tenxMath: null,
      tenxScenarios: input.draft.tenxScenarios,
      tenxFeasibility: input.draft.tenxFeasibility,
    });
  }

  let o;
  try {
    o = scoreOversold(derived);
  } catch {
    o = scoreOversold({ ...derived, revenueYoY: null, evSales: null, pe: null, pb: null, drawdown52w: null, netDebt: null, cash: null, fcf: null });
  }

  let q;
  try {
    q = scoreQuality(derived);
  } catch {
    q = scoreQuality(derived);
  }

  const lenses = scoreLenses({ m: derived, x, o, q });
  const tags = strategyTags(x, o, q);
  const rp = researchPriority({
    x,
    o,
    q,
    lenses,
    enabled: input.researchPriorityOn !== false,
  });
  const overallCoverage = (x.coverage + o.coverage + q.coverage) / 3;
  const overallConfidence: Snapshot["overallConfidence"] =
    overallCoverage >= 0.85 ? "High" : overallCoverage >= 0.65 ? "Medium" : "Low";

  return {
    id: uid("snap"),
    companyId: input.company.id,
    asOf,
    createdAt: asOf,
    sample: input.company.sample,
    price: input.quote.price,
    marketCap: input.quote.marketCap,
    enterpriseValue: input.quote.enterpriseValue,
    currency: input.quote.currency,
    financials: input.quote.financials,
    derived,
    evidence: input.draft.evidences,
    xbagger: x,
    oversold: o,
    quality: q,
    lenses,
    tags,
    researchPriority: rp?.score ?? null,
    researchPriorityParts: rp?.parts ?? null,
    oneSentenceThesis: input.draft.thesis,
    catalysts: input.draft.catalysts,
    risks: input.draft.risks,
    nextProof: input.draft.nextProof,
    killCriteria: input.draft.killCriteria,
    findings: input.draft.findings ?? [],
    overallCoverage,
    overallConfidence,
    researchProvider: input.draft.researchProvider,
    tenxMath: input.draft.tenxMath ?? x.tenxMath,
    tenxScenarios: input.draft.tenxScenarios,
    industryAdapter: adapter,
    sourceAttempts: input.quote.sourceAttempts,
    statementBasis: input.quote.extras?.statementBasis ?? null,
    periodType: input.quote.extras?.periodType ?? null,
    fiscalYear: input.quote.extras?.fiscalYear ?? null,
  };
}

export function runSnapshot(input: {
  company: Company;
  quote: ResearchQuote;
  pack?: ResearchPack;
  asOf?: string;
  researchPriorityOn?: boolean;
  extras?: Parameters<typeof deriveMetrics>[0]["extras"];
}): Snapshot {
  const pack = input.pack ?? emptyPack();
  const draft = heuristicDraft(input.quote, pack);
  return finishSnapshot({ ...input, draft });
}

export function runSnapshotFromDraft(input: {
  company: Company;
  draft: ResearchDraft;
  pack?: ResearchPack;
  asOf?: string;
  researchPriorityOn?: boolean;
}): Snapshot {
  return finishSnapshot({
    company: input.company,
    quote: input.draft.quote,
    draft: input.draft,
    asOf: input.asOf,
    researchPriorityOn: input.researchPriorityOn,
  });
}

export function snapshotToDraft(snap: Snapshot, company: Company): ResearchDraft {
  return {
    quote: {
      ticker: company.ticker,
      exchange: company.exchange,
      companyName: company.companyName,
      currency: snap.currency,
      price: snap.price,
      marketCap: snap.marketCap,
      enterpriseValue: snap.enterpriseValue,
      country: company.country,
      sector: company.sector,
      industry: company.industry,
      financials: snap.financials,
    },
    factors: snap.xbagger.factors.map((f) => ({
      code: f.code,
      score: f.score,
      summary: f.reason,
      confidence: f.confidence,
    })),
    redFlags: [],
    tenxScenarios: snap.tenxScenarios,
    tenxMath: snap.tenxMath ?? snap.xbagger.tenxMath ?? undefined,
    requiredRevenue: null,
    requiredNetIncome: null,
    requiredPe: null,
    requiredEvSales: null,
    tenxFeasibility: snap.xbagger.tenxFeasibility,
    catalysts: snap.catalysts,
    risks: snap.risks,
    nextProof: snap.nextProof,
    killCriteria: snap.killCriteria,
    thesis: snap.oneSentenceThesis,
    evidences: snap.evidence,
    findings: snap.findings,
    researchProvider: snap.researchProvider,
  };
}

export function buildQueue(snapshots: Snapshot[]): Array<{
  id: string;
  companyId: string;
  ticker: string;
  factor: string;
  engine: "xbagger" | "oversold" | "quality";
  reason: string;
  priority: number;
}> {
  const items: ReturnType<typeof buildQueue> = [];
  for (const s of snapshots) {
    for (const f of s.xbagger.factors) {
      if (f.score == null) {
        const gateBoost = ["F7", "F10", "F6", "F1"].includes(f.code) ? 20 : 0;
        items.push({
          id: `${s.id}_${f.id}`,
          companyId: s.companyId,
          ticker: "",
          factor: f.id,
          engine: "xbagger",
          reason: f.reason,
          priority: f.weight * 8 + gateBoost,
        });
      }
    }
    if (s.oversold.status === "RESEARCH REQUIRED") {
      items.push({
        id: `${s.id}_osm`,
        companyId: s.companyId,
        ticker: "",
        factor: "OSM",
        engine: "oversold",
        reason: "Oversold coverage < 70%",
        priority: 40,
      });
    }
    for (const f of s.quality.factors) {
      if (f.status === "NA" && f.kind === "Core" && f.applicability === "A") {
        items.push({
          id: `${s.id}_${f.id}`,
          companyId: s.companyId,
          ticker: "",
          factor: f.id,
          engine: "quality",
          reason: f.reason,
          priority: 12,
        });
      }
    }
  }
  return items.sort((a, b) => b.priority - a.priority);
}

