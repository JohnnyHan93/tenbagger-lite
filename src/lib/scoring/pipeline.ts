import { SCORING_VERSION, FACTOR_ORDER, type FactorCode } from "./config.ts";
import { scoreAnalysis } from "./wildcard-score.ts";
import {
  defaultScenarios,
  feasibilityFromMath,
  requiredEvSalesFor10x,
  requiredNetIncomeFor10x,
  requiredPeFor10x,
  requiredRevenueFor10x,
} from "../tenx/calculator.ts";
import { thesisFromDraft } from "../thesis/generator.ts";
import { defaultFlags } from "../risk/flags.ts";
import { uid } from "../utils.ts";
import type {
  Analysis,
  FactorScore,
  ResearchDraft,
} from "../types.ts";


export function emptyFactorScores(): FactorScore[] {
  return FACTOR_ORDER.map((code) => ({
    factorCode: code,
    score: 0,
    evidenceSummary: "UNKNOWN",
    originalScore: 0,
    overrideScore: null,
    overrideReason: null,
    overrideDate: null,
  }));
}

export function draftToFactorScores(draft: ResearchDraft): FactorScore[] {
  const byCode = new Map(draft.factors.map((f) => [f.code, f]));
  return FACTOR_ORDER.map((code) => {
    const f = byCode.get(code);
    const score = f ? Math.min(2, Math.max(0, Math.round(f.score))) : 0;
    return {
      factorCode: code as FactorCode,
      score,
      evidenceSummary: f?.summary || "UNKNOWN",
      found: f?.found,
      benchmark: f?.benchmark,
      originalScore: score,
      overrideScore: null,
      overrideReason: null,
      overrideDate: null,
    };
  });
}

export function materializeAnalysis(
  companyId: string,
  draft: ResearchDraft,
  analysisDate = new Date().toISOString(),
): Analysis {
  const factorScores = draftToFactorScores(draft);
  const flags = draft.redFlags.length ? draft.redFlags : defaultFlags();
  const scored = scoreAnalysis(factorScores, flags);
  const f10 = factorScores.find((f) => f.factorCode === "F10")?.score ?? 0;
  const tenxRed = flags.some((f) => f.flagType === "TENX" && (f.hardStop || f.status === "RED"));
  let scenarios = draft.tenxScenarios;
  if (scenarios.length < 2) {
    const d = defaultScenarios(draft.quote.marketCap, draft.quote.financials);
    scenarios = [d.base, d.bull];
  }
  const feasibility =
    draft.tenxFeasibility || feasibilityFromMath(scenarios, f10, tenxRed);
  const { thesis, gate } = thesisFromDraft({
    ...draft,
    tenxFeasibility: feasibility,
    tenxScenarios: scenarios,
  });

  const netMargin =
    scenarios.find((s) => s.scenario === "BASE")?.netMargin ?? 0.12;
  const evs =
    scenarios.find((s) => s.multipleType === "EV_SALES")?.multipleValue ?? 8;
  const pe =
    scenarios.find((s) => s.multipleType === "PE")?.multipleValue ?? 25;

  return {
    id: uid("a"),
    companyId,
    analysisDate,
    price: draft.quote.price,
    marketCap: draft.quote.marketCap,
    enterpriseValue: draft.quote.enterpriseValue || draft.quote.marketCap,
    currency: draft.quote.currency,
    financials: draft.quote.financials,
    factorScores,
    factorTotal: scored.factorTotal,
    rawScore: scored.rawScore,
    adjustedScore: scored.adjustedScore,
    grade: scored.grade,
    verdict: scored.verdict,
    tenxFeasibility: feasibility,
    redFlags: flags,
    hardStop: scored.hardStop,
    tenxScenarios: scenarios,
    requiredRevenue:
      draft.requiredRevenue ??
      requiredRevenueFor10x(draft.quote.marketCap, "EV_SALES", evs, netMargin),
    requiredNetIncome:
      draft.requiredNetIncome ?? requiredNetIncomeFor10x(draft.quote.marketCap, pe),
    requiredMarketShare: null,
    requiredPe: draft.requiredPe ?? requiredPeFor10x(draft.quote.marketCap, scenarios[0]?.netIncome ?? 0),
    requiredEvSales:
      draft.requiredEvSales ??
      requiredEvSalesFor10x(draft.quote.marketCap, scenarios[0]?.revenue ?? 0),
    oneSentenceThesis: thesis,
    thesisGate: scored.hardStop || feasibility === "UNREALISTIC" ? "FAIL" : gate,
    catalysts: draft.catalysts.slice(0, 5),
    risks: draft.risks.slice(0, 5),
    nextProof: draft.nextProof.slice(0, 3),
    killCriteria: draft.killCriteria.slice(0, 3),
    evidences: draft.evidences,
    findings: draft.findings ?? [],
    scoringVersion: SCORING_VERSION,
    researchProvider: draft.researchProvider,
    createdAt: analysisDate,
  };
}

export function applyFactorOverride(
  analysis: Analysis,
  code: FactorCode,
  overrideScore: number,
  reason: string,
): Analysis {
  const factorScores = analysis.factorScores.map((fs) =>
    fs.factorCode === code
      ? {
          ...fs,
          overrideScore,
          overrideReason: reason,
          overrideDate: new Date().toISOString(),
        }
      : fs,
  );
  const scored = scoreAnalysis(factorScores, analysis.redFlags);
  return {
    ...analysis,
    factorScores,
    factorTotal: scored.factorTotal,
    rawScore: scored.rawScore,
    adjustedScore: scored.adjustedScore,
    grade: scored.grade,
    verdict: scored.verdict,
    hardStop: scored.hardStop,
  };
}
