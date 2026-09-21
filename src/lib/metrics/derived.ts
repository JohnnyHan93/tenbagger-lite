import type { FinancialSnapshot, FinancialSeries } from "../types.ts";
import type { IndustryGroup } from "../engines/industry.ts";
import { numericField, pointsOf, seriesTrusted, yoyFromFy, latestFy, omDeltaFromSeries } from "./series.ts";

export interface DerivedMetrics {
  revenueTtm: number | null;
  revenuePrior: number | null;
  revenueYoY: number | null;
  revenueCagr3y: number | null;
  opTtm: number | null;
  opPrior: number | null;
  opGrowth: number | null;
  niTtm: number | null;
  gm: number | null;
  om: number | null;
  nm: number | null;
  gmChange: number | null;
  omChange: number | null;
  fcf: number | null;
  cfo: number | null;
  fcfMargin: number | null;
  cfoMargin: number | null;
  cashConversion: number | null;
  accrual: number | null;
  cash: number | null;
  debt: number | null;
  netDebt: number | null;
  netDebtEbitda: number | null;
  interestCoverage: number | null;
  assets: number | null;
  cashToAssets: number | null;
  stDebtToCash: number | null;
  shares: number | null;
  shareGrowth: number | null;
  arGrowthGap: number | null;
  invGrowthGap: number | null;
  cccChange: number | null;
  capex: number | null;
  capexToRev: number | null;
  rdToRev: number | null;
  rdGrowth: number | null;
  backlogGrowth: number | null;
  bookToBill: number | null;
  roic: number | null;
  roicChange: number | null;
  assetTurnover: number | null;
  drawdown52w: number | null;
  return3m: number | null;
  return6m: number | null;
  marketCap: number;
  enterpriseValue: number;
  pe: number | null;
  evSales: number | null;
  evEbitda: number | null;
  pb: number | null;
  customerConcentration: number | null;
  industryGroup: IndustryGroup;
  high52w: number | null;
  price: number;
  investedCapital?: number | null;
  goingConcernEvidence?: boolean;
  series?: import("../types.ts").FinancialSeries | null;
  liquidityStress?: boolean;
  organicShare?: number | null;
  runwayYears?: number | null;
}

export function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

export function change(curr: number | null | undefined, prior: number | null | undefined): number | null {
  if (curr == null || prior == null || !Number.isFinite(curr) || !Number.isFinite(prior) || prior === 0) {
    return null;
  }
  return curr / prior - 1;
}

export function cashRunwayYears(
  cash: number | null | undefined,
  fcf: number | null | undefined,
  op?: number | null,
): number | null {
  if (cash == null || !Number.isFinite(cash) || cash <= 0) return null;
  const burn = Math.max(0, -(fcf ?? 0), op != null && op < 0 ? -op : 0);
  if (burn <= 0) return null;
  return cash / burn;
}

export function cagrFromSeries(
  series: FinancialSeries | null | undefined,
  field: "revenue" | "operatingIncome" | "netIncome" | "cfo" | "fcf",
  nPoints = 4,
): number | null {
  if (!seriesTrusted(series)) return null;
  const vals = numericField(pointsOf(series, "FY"), field);
  if (vals.length < nPoints) return null;
  const first = vals[vals.length - nPoints];
  const last = vals[vals.length - 1];
  if (first == null || last == null || first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / (nPoints - 1)) - 1;
}

export function deriveMetrics(input: {
  price: number;
  marketCap: number;
  enterpriseValue: number;
  financials: FinancialSnapshot;
  industryGroup: IndustryGroup;
  extras?: Partial<DerivedMetrics>;
}): DerivedMetrics {
  const f = input.financials;
  const x = input.extras ?? {};
  const revenueYoY = x.revenueYoY ?? change(f.revenueTtm, f.revenuePrior);
  const series = x.series ?? null;
  const revenueCagr3y = x.revenueCagr3y ?? cagrFromSeries(series, "revenue", 4);
  const opPrior =
    x.opPrior ?? (series ? numericField(pointsOf(series, "FY"), "operatingIncome").at(-2) ?? null : null);
  const om = x.om ?? f.operatingMargin ?? ratio(f.operatingIncomeTtm, f.revenueTtm);
  const nm = x.nm ?? ratio(f.netIncomeTtm, f.revenueTtm);
  const cfo = x.cfo ?? f.cfo ?? null;
  const fcf = x.fcf ?? f.fcf ?? null;
  const capexRaw = x.capex ?? latestFy(series, "capex");
  const capex = capexRaw != null ? Math.abs(capexRaw) : null;
  const investedCapital = x.investedCapital ?? latestFy(series, "investedCapital");
  const shareGrowth = x.shareGrowth ?? yoyFromFy(series, "dilutedShares");
  const omChange = x.omChange ?? omDeltaFromSeries(series);
  const fcfMargin = x.fcfMargin ?? ratio(fcf, f.revenueTtm);
  const cfoMargin = x.cfoMargin ?? ratio(cfo, f.revenueTtm);
  const cashConversion = x.cashConversion ?? ratio(cfo, f.netIncomeTtm);
  const netDebt =
    x.netDebt ??
    (f.totalDebt != null || f.cash != null ? (f.totalDebt ?? 0) - (f.cash ?? 0) : null);
  const ebitda = f.operatingIncomeTtm;
  const evSales = ratio(input.enterpriseValue, f.revenueTtm);
  const pe = ratio(input.marketCap, f.netIncomeTtm);
  const evEbitda = ratio(input.enterpriseValue, ebitda);
  const cashToAssets = x.cashToAssets ?? ratio(f.cash, x.assets ?? null);
  const drawdown52w =
    x.drawdown52w ??
    (x.high52w && input.price > 0 ? 1 - input.price / x.high52w : null);

  return {
    revenueTtm: f.revenueTtm,
    revenuePrior: f.revenuePrior,
    revenueYoY,
    revenueCagr3y,
    opTtm: f.operatingIncomeTtm,
    opPrior,
    opGrowth: x.opGrowth ?? change(f.operatingIncomeTtm, opPrior),
    niTtm: f.netIncomeTtm,
    gm: f.grossMargin,
    om,
    nm,
    gmChange: x.gmChange ?? null,
    omChange,
    fcf,
    cfo,
    fcfMargin,
    cfoMargin,
    cashConversion,
    accrual: x.accrual ?? null,
    cash: f.cash,
    debt: f.totalDebt,
    netDebt,
    netDebtEbitda: x.netDebtEbitda ?? ratio(netDebt, ebitda),
    interestCoverage: x.interestCoverage ?? null,
    assets: x.assets ?? null,
    cashToAssets,
    stDebtToCash: x.stDebtToCash ?? null,
    shares: f.sharesOutstanding,
    shareGrowth,
    arGrowthGap: x.arGrowthGap ?? null,
    invGrowthGap: x.invGrowthGap ?? null,
    cccChange: x.cccChange ?? null,
    capex,
    capexToRev: x.capexToRev ?? ratio(capex, f.revenueTtm),
    rdToRev: x.rdToRev ?? null,
    rdGrowth: x.rdGrowth ?? null,
    backlogGrowth: x.backlogGrowth ?? null,
    bookToBill: x.bookToBill ?? null,
    roic: x.roic ?? null,
    roicChange: x.roicChange ?? null,
    assetTurnover: x.assetTurnover ?? ratio(f.revenueTtm, x.assets ?? null),
    drawdown52w,
    return3m: x.return3m ?? null,
    return6m: x.return6m ?? null,
    marketCap: input.marketCap,
    enterpriseValue: input.enterpriseValue,
    pe: pe != null && pe > 0 ? pe : null,
    evSales: evSales != null && evSales > 0 ? evSales : null,
    evEbitda: evEbitda != null && evEbitda > 0 ? evEbitda : null,
    pb: x.pb ?? null,
    customerConcentration: x.customerConcentration ?? null,
    industryGroup: input.industryGroup,
    high52w: x.high52w ?? null,
    price: input.price,
    investedCapital,
    goingConcernEvidence: Boolean(x.goingConcernEvidence),
    series: x.series ?? null,
    organicShare: x.organicShare ?? null,
    runwayYears: x.runwayYears ?? cashRunwayYears(f.cash, fcf, f.operatingIncomeTtm),
    liquidityStress: Boolean(
      (f.cash != null && f.cash < 0) ||
        ((fcf ?? 0) < 0 && f.cash != null && f.cash < Math.abs(fcf ?? 0)),
    ),
  };
}
