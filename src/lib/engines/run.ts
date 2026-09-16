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
import { criteriaProvenance, getCriteria } from "./criteria/index.ts";
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
      series: input.quote.extras?.series ?? null,
      investedCapital: input.quote.extras?.investedCapital ?? null,
      goingConcernEvidence: input.quote.extras?.goingConcernEvidence ?? false,
      rdToRev: input.quote.extras?.rdToRev ?? null,
      rdGrowth: input.quote.extras?.rdGrowth ?? null,
      backlogGrowth: input.quote.extras?.backlogGrowth ?? null,
      bookToBill: input.quote.extras?.bookToBill ?? null,
      customerConcentration: input.quote.extras?.customerConcentration ?? null,
      interestCoverage: input.quote.extras?.interestCoverage ?? null,
      organicShare: input.quote.extras?.organicShare ?? null,
      ...input.extras,
    },
  });

  const pack = getCriteria();
  const fcf = input.quote.financials.fcf;
  const cash = input.quote.financials.cash;
  const op = input.quote.financials.operatingIncomeTtm;
  const burn = Math.max(0, -(fcf ?? 0), op != null && op < 0 ? -op : 0);
  const runwayYears = burn > 0 && cash != null && cash > 0 ? cash / burn : null;
  const named = input.draft.evidences.some((e) => /customer|고객|named/i.test(`${e.title ?? ""} ${e.evidence}`))
    || input.draft.factors.find((f) => f.code === "F6")?.found
    || input.draft.factors.find((f) => f.code === "F6")?.summary?.includes("고객");
  const f6summary = input.draft.factors.find((f) => f.code === "F6")?.summary ?? "";
  const f6found = input.draft.factors.find((f) => f.code === "F6")?.found ?? "";
  const customerEvidence = {
    named: Boolean(named && !/고객명 없음|매출만/.test(`${f6summary} ${f6found}`)),
    paid: /유료|paid|repeat|갱신|수주/i.test(f6summary),
    repeat: /repeat|반복|갱신|수주/i.test(f6summary),
    retention: /retention|구독|subscriber/i.test(f6summary),
    model: "unknown" as const,
  };

  let x;
  try {
    x = scoreXBagger(
      {
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
        trustSignals: {
          management: input.draft.redFlags.some((f) => f.flagType === "MANAGEMENT" && f.hardStop),
          auditGoingConcern: Boolean(input.quote.extras?.goingConcernEvidence),
        },
        survivalEvidence: {
          fcf: input.quote.financials.fcf,
          cfo: input.quote.financials.cfo ?? derived.cfo,
          cash: input.quote.financials.cash,
          debt: input.quote.financials.totalDebt,
          runwayYears,
        },
        customerEvidence,
      },
      pack.engines.xbagger,
    );
  } catch {
    x = scoreXBagger(
      {
        factors: input.draft.factors.map((f) => ({
          code: f.code as FactorCode,
          score: null,
          reason: "X-Bagger provider error — N/A",
        })),
        tenxMath: null,
        tenxScenarios: input.draft.tenxScenarios,
        tenxFeasibility: input.draft.tenxFeasibility,
      },
      pack.engines.xbagger,
    );
  }

  let o;
  try {
    o = scoreOversold(derived, pack.engines.oversold);
  } catch {
    o = scoreOversold(
      { ...derived, revenueYoY: null, evSales: null, pe: null, pb: null, drawdown52w: null, netDebt: null, cash: null, fcf: null },
      pack.engines.oversold,
    );
  }

  let q;
  try {
    q = scoreQuality(derived, pack.engines.quality70);
  } catch {
    q = scoreQuality(derived, pack.engines.quality70);
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
    criteria: criteriaProvenance(pack),
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
      high52w: snap.derived.high52w,
      pb: snap.derived.pb,
      extras: {
        assets: snap.derived.assets,
        capex: snap.derived.capex,
        cfo: snap.derived.cfo,
        roic: snap.derived.roic,
        drawdown52w: snap.derived.drawdown52w,
        opPrior: snap.derived.opPrior,
        omChange: snap.derived.omChange,
        nm: snap.derived.nm,
        series: snap.derived.series ?? null,
        investedCapital: snap.derived.investedCapital,
        goingConcernEvidence: Boolean(snap.derived.goingConcernEvidence),
        statementBasis: snap.statementBasis,
        periodType: snap.periodType,
        fiscalYear: snap.fiscalYear,
        rdToRev: snap.derived.rdToRev,
        rdGrowth: snap.derived.rdGrowth,
        backlogGrowth: snap.derived.backlogGrowth,
        bookToBill: snap.derived.bookToBill,
        customerConcentration: snap.derived.customerConcentration,
        interestCoverage: snap.derived.interestCoverage,
        organicShare: snap.derived.organicShare,
      },
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
    if (!s?.xbagger?.factors || !s.oversold || !s.quality?.factors) continue;
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

