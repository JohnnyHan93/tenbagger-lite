import { heuristicDraft } from "../research/heuristic.ts";
import { emptyPack, type ResearchPack } from "../research/pack.ts";
import type { Company, ResearchQuote } from "../types.ts";
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

export function runSnapshot(input: {
  company: Company;
  quote: ResearchQuote;
  pack?: ResearchPack;
  asOf?: string;
  researchPriorityOn?: boolean;
  extras?: Parameters<typeof deriveMetrics>[0]["extras"];
}): Snapshot {
  const asOf = input.asOf ?? new Date().toISOString();
  const pack = input.pack ?? emptyPack();
  const draft = heuristicDraft(input.quote, pack);
  const group = industryGroupOf(input.quote.sector, input.quote.industry);
  const derived = deriveMetrics({
    price: input.quote.price,
    marketCap: input.quote.marketCap,
    enterpriseValue: input.quote.enterpriseValue,
    financials: input.quote.financials,
    industryGroup: group,
    extras: input.extras,
  });

  const x = scoreXBagger({
    factors: draft.factors.map((f) => ({
      code: f.code as FactorCode,
      score: f.score,
      reason: f.summary,
      confidence: f.confidence,
      evidenceIds: draft.evidences.filter((e) => e.factorCode === f.code).map((e) => e.id),
    })),
    tenxMath: draft.tenxMath ?? null,
    tenxScenarios: draft.tenxScenarios,
    tenxFeasibility: draft.tenxFeasibility,
    trustFail: draft.redFlags.some((f) => f.flagType === "MANAGEMENT" && f.hardStop),
  });
  const o = scoreOversold(derived);
  const q = scoreQuality(derived);
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
    evidence: draft.evidences,
    xbagger: x,
    oversold: o,
    quality: q,
    lenses,
    tags,
    researchPriority: rp?.score ?? null,
    researchPriorityParts: rp?.parts ?? null,
    oneSentenceThesis: draft.thesis,
    catalysts: draft.catalysts,
    risks: draft.risks,
    nextProof: draft.nextProof,
    killCriteria: draft.killCriteria,
    findings: draft.findings ?? [],
    overallCoverage,
    overallConfidence,
    researchProvider: draft.researchProvider,
    tenxMath: draft.tenxMath ?? x.tenxMath,
    tenxScenarios: draft.tenxScenarios,
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
    if (s.oversold.oversold == null) {
      items.push({
        id: `${s.id}_os_dd`,
        companyId: s.companyId,
        ticker: "",
        factor: "52W drawdown",
        engine: "oversold",
        reason: s.oversold.reasons.oversold,
        priority: 30,
      });
    }
    for (const f of s.quality.factors) {
      if (f.kind === "Core" && f.status === "NA" && f.applicability !== "N") {
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
  return items.sort((a, b) => b.priority - a.priority).slice(0, 80);
}
