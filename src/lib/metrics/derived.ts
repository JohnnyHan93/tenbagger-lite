import type { FinancialSnapshot } from "../types.ts";
import type { IndustryGroup } from "../engines/industry.ts";

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
  const om = x.om ?? f.operatingMargin ?? ratio(f.operatingIncomeTtm, f.revenueTtm);
  const nm = x.nm ?? ratio(f.netIncomeTtm, f.revenueTtm);
  const fcfMargin = x.fcfMargin ?? ratio(f.fcf, f.revenueTtm);
  const cfo = x.cfo ?? f.fcf;
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
    revenueCagr3y: x.revenueCagr3y ?? null,
    opTtm: f.operatingIncomeTtm,
    opPrior: x.opPrior ?? null,
    opGrowth: x.opGrowth ?? change(f.operatingIncomeTtm, x.opPrior ?? null),
    niTtm: f.netIncomeTtm,
    gm: f.grossMargin,
    om,
    nm,
    gmChange: x.gmChange ?? null,
    omChange: x.omChange ?? null,
    fcf: f.fcf,
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
    shareGrowth: x.shareGrowth ?? null,
    arGrowthGap: x.arGrowthGap ?? null,
    invGrowthGap: x.invGrowthGap ?? null,
    cccChange: x.cccChange ?? null,
    capex: x.capex ?? null,
    capexToRev: x.capexToRev ?? ratio(x.capex ?? null, f.revenueTtm),
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
  };
}
