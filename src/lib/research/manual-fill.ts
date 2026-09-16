import type { Company, FinancialSeries, FinancialSeriesPoint, ResearchQuote } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { emptyPack, type ResearchPack } from "./pack.ts";
import { runSnapshot } from "../engines/run.ts";
import { formatPct } from "../format.ts";
import type { FillFieldKey } from "./data-needs.ts";
import { parseUserMoney } from "./quote-parse.ts";

export type ManualFillPatch = {
  financials?: Partial<ResearchQuote["financials"]>;
  high52w?: number | null;
  pb?: number | null;
  extras?: Partial<NonNullable<ResearchQuote["extras"]>> & {
    rdToRev?: number | null;
    rdGrowth?: number | null;
    backlogGrowth?: number | null;
    bookToBill?: number | null;
    customerConcentration?: number | null;
    interestCoverage?: number | null;
    organicShare?: number | null;
  };
  series?: Partial<Record<string, Array<number | null>>>;
  qRevenue?: Array<number | null>;
  pack?: {
    customers?: string[];
    tamCagr?: number;
    marketShare?: number;
    moat?: string;
  };
};

const FY_MAP: Record<string, keyof FinancialSeriesPoint> = {
  fyRevenue: "revenue",
  fyOp: "operatingIncome",
  fyNi: "netIncome",
  fyCfo: "cfo",
  fyFcf: "fcf",
  fyPpe: "ppe",
  fyCapex: "capex",
  fyIc: "investedCapital",
  fyEps: "epsDiluted",
  fyDebt: "debt",
  fyShares: "dilutedShares",
};

export function parsePctInput(raw: string): number | null {
  const t = raw.trim().replace(/%/g, "").replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > 1) return n / 100;
  return n;
}

export function parseListInput(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

export function parseMoneyInput(raw: string): number | null {
  return parseUserMoney(raw);
}

export function quoteFromSnapshot(snap: Snapshot, company: Company): ResearchQuote {
  return {
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
    financials: { ...snap.financials },
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
    sourceAttempts: snap.sourceAttempts,
  };
}

function packFromSnapshot(snap: Snapshot): ResearchPack {
  const pack = emptyPack();
  const f4 = snap.evidence.find((e) => e.factorCode === "F4");
  const f6 = snap.evidence.find((e) => e.factorCode === "F6");
  pack.profile = (f4?.statement ?? f4?.evidence ?? "").slice(0, 800);
  if (f6?.evidence) {
    const named = f6.evidence.replace(/^공개 고객:\s*/i, "");
    pack.customers = parseListInput(named);
  }
  pack.news = snap.catalysts.slice(0, 5).map((title) => ({ title, date: snap.asOf.slice(0, 10), url: "" }));
  pack.techClaims = snap.xbagger.factors.find((f) => f.code === "F4")?.reason ? [snap.xbagger.factors.find((f) => f.code === "F4")!.reason] : [];
  return pack;
}

function mergeFy(
  current: FinancialSeries | null | undefined,
  triples: Partial<Record<string, Array<number | null>>>,
  qRevenue?: Array<number | null>,
): FinancialSeries | null {
  const fy = (current?.points ?? []).filter((p) => p.periodType === "FY").slice().sort((a, b) => a.period.localeCompare(b.period));
  const q = (current?.points ?? []).filter((p) => p.periodType === "Q").slice().sort((a, b) => a.period.localeCompare(b.period));
  const y = new Date().getFullYear();
  const periods = fy.length >= 3 ? fy.slice(-3).map((p) => p.period) : [`${y - 2}-12-31`, `${y - 1}-12-31`, `${y}-12-31`];
  const by = new Map<string, FinancialSeriesPoint>();
  for (const p of fy) by.set(p.period, { ...p });
  let wrote = false;
  for (let i = 0; i < 3; i++) {
    const period = periods[i]!;
    const prev: FinancialSeriesPoint = by.get(period) ?? { period, periodType: "FY" };
    for (const [key, field] of Object.entries(FY_MAP)) {
      const v = triples[key]?.[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        prev[field] = v as never;
        wrote = true;
      }
    }
    by.set(period, prev);
  }
  const qPts = q.map((p) => ({ ...p }));
  if (qRevenue && qRevenue.filter((n) => typeof n === "number" && Number.isFinite(n)).length) {
    const qPeriods =
      qPts.length >= 2
        ? qPts.slice(-2).map((p) => p.period)
        : [`${y}-06-30`, `${y}-09-30`];
    for (let i = 0; i < 2; i++) {
      const period = qPeriods[i]!;
      const existing = qPts.find((p) => p.period === period);
      const v = qRevenue[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (existing) existing.revenue = v;
        else qPts.push({ period, periodType: "Q", revenue: v });
        wrote = true;
      }
    }
  }
  if (!wrote && current?.points?.length) return current;
  if (!wrote) return current ?? null;
  const points = [...by.values(), ...qPts].sort((a, b) => `${a.periodType}:${a.period}`.localeCompare(`${b.periodType}:${b.period}`));
  return {
    points,
    provenance: [
      ...(current?.provenance ?? []),
      { period: periods.at(-1) ?? "", sourceTier: "MANUAL", sourceName: "user fill" },
    ],
  };
}

export function applyManualFill(snap: Snapshot, company: Company, patch: ManualFillPatch): Snapshot {
  const quote = quoteFromSnapshot(snap, company);
  if (patch.financials) {
    quote.financials = {
      ...quote.financials,
      ...Object.fromEntries(
        Object.entries(patch.financials).filter(([, v]) => typeof v === "number" && Number.isFinite(v)),
      ),
    };
    if (
      quote.financials.operatingMargin == null &&
      quote.financials.revenueTtm &&
      quote.financials.operatingIncomeTtm != null &&
      quote.financials.revenueTtm !== 0
    ) {
      quote.financials.operatingMargin = quote.financials.operatingIncomeTtm / quote.financials.revenueTtm;
    }
    if (
      quote.financials.grossMargin == null &&
      typeof patch.financials.grossMargin === "number"
    ) {
      quote.financials.grossMargin = patch.financials.grossMargin;
    }
  }
  if (typeof patch.high52w === "number") quote.high52w = patch.high52w;
  if (typeof patch.pb === "number") quote.pb = patch.pb;
  quote.extras = { ...quote.extras, ...patch.extras };
  if (patch.extras?.goingConcernEvidence) quote.extras.goingConcernEvidence = true;
  quote.extras.series = mergeFy(quote.extras.series ?? null, patch.series ?? {}, patch.qRevenue);
  quote.sourceAttempts = [
    ...(quote.sourceAttempts ?? []),
    {
      provider: "manual-fill",
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "ok",
      notes: "user filled engine gaps",
    },
  ];

  const pack = packFromSnapshot(snap);
  if (patch.pack?.customers?.length) pack.customers = patch.pack.customers;
  if (patch.pack?.moat) pack.techClaims = [patch.pack.moat, ...pack.techClaims];
  const bits: string[] = [pack.profile];
  if (patch.pack?.moat) bits.push(patch.pack.moat);
  if (patch.pack?.tamCagr != null) bits.push(`TAM CAGR ${formatPct(patch.pack.tamCagr)}`);
  if (patch.pack?.marketShare != null) bits.push(`${formatPct(patch.pack.marketShare)} market share`);
  pack.profile = bits.filter(Boolean).join(". ");

  return runSnapshot({
    company,
    quote,
    pack,
    extras: {
      series: quote.extras.series,
      assets: quote.extras.assets,
      capex: quote.extras.capex,
      cfo: quote.extras.cfo,
      roic: quote.extras.roic,
      investedCapital: quote.extras.investedCapital,
      goingConcernEvidence: quote.extras.goingConcernEvidence,
      drawdown52w: quote.extras.drawdown52w,
      high52w: quote.high52w,
      pb: quote.pb,
      rdToRev: quote.extras.rdToRev,
      rdGrowth: quote.extras.rdGrowth,
      backlogGrowth: quote.extras.backlogGrowth,
      bookToBill: quote.extras.bookToBill,
      customerConcentration: quote.extras.customerConcentration,
      interestCoverage: quote.extras.interestCoverage,
      organicShare: quote.extras.organicShare,
    },
  });
}

export function emptyPatchFromFields(keys: FillFieldKey[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = "";
  return out;
}
