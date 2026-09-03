import { runSnapshot } from "./engines/run.ts";
import type { Snapshot } from "./domain/snapshot.ts";
import type { Company, FinancialSnapshot, ResearchQuote } from "./types.ts";
import type { DerivedMetrics } from "./metrics/derived.ts";

const AS_OF = "2026-09-03T00:00:00.000Z";

function company(
  id: string,
  ticker: string,
  exchange: string,
  name: string,
  country: string,
  sector: string,
  industry: string,
): Company {
  return {
    id,
    ticker,
    exchange,
    companyName: name,
    country,
    sector,
    industry,
    sample: true,
    cohort: "sample",
    createdAt: AS_OF,
    updatedAt: AS_OF,
  };
}

function fin(p: Partial<FinancialSnapshot>): FinancialSnapshot {
  return {
    revenueTtm: null,
    revenuePrior: null,
    operatingIncomeTtm: null,
    netIncomeTtm: null,
    cash: null,
    totalDebt: null,
    sharesOutstanding: null,
    grossMargin: null,
    operatingMargin: null,
    fcf: null,
    ...p,
  };
}

function quote(c: Company, price: number, mcap: number, ev: number, financials: FinancialSnapshot): ResearchQuote {
  return {
    ticker: c.ticker,
    exchange: c.exchange,
    companyName: c.companyName,
    currency: c.country === "KR" ? "KRW" : "USD",
    price,
    marketCap: mcap,
    enterpriseValue: ev,
    country: c.country,
    sector: c.sector,
    industry: c.industry,
    financials,
  };
}

const C1 = company("c_smpl_soft", "SMPL-SOFT", "NASDAQ", "Northline Software (SAMPLE)", "US", "Information Technology", "Application Software");
const C2 = company("c_smpl_qual", "SMPL-QUAL", "NYSE", "Harbor Brands (SAMPLE)", "US", "Consumer Staples", "Household Products");
const C3 = company("c_smpl_cycl", "SMPL-CYCL", "NYSE", "Redridge Materials (SAMPLE)", "US", "Materials", "Specialty Chemicals");
const C4 = company("c_smpl_semi", "005290.KS", "KRX", "에코반도체장비 (SAMPLE)", "KR", "Information Technology", "Semiconductor Equipment");
const C5 = company("c_smpl_krq", "000990.KS", "KRX", "한강생활 (SAMPLE)", "KR", "Consumer Staples", "Food Products");
const C6 = company("c_smpl_kros", "012330.KS", "KRX", "서해모빌리티 (SAMPLE)", "KR", "Consumer Discretionary", "Auto Parts");

type Extra = Partial<DerivedMetrics>;

function snap(c: Company, q: ResearchQuote, extras: Extra): Snapshot {
  return {
    ...runSnapshot({
      company: c,
      quote: q,
      asOf: AS_OF,
      extras,
      researchPriorityOn: true,
    }),
    id: `snap_${c.id}`,
    sample: true,
  };
}

export function buildSampleWorld(): { companies: Company[]; snapshots: Snapshot[] } {
  const companies = [C1, C2, C3, C4, C5, C6];
  const snapshots = [
    snap(
      C1,
      quote(C1, 48, 4_200_000_000, 3_900_000_000, fin({
        revenueTtm: 620_000_000,
        revenuePrior: 430_000_000,
        operatingIncomeTtm: 40_000_000,
        netIncomeTtm: 22_000_000,
        cash: 480_000_000,
        totalDebt: 80_000_000,
        sharesOutstanding: 87_000_000,
        grossMargin: 0.78,
        operatingMargin: 0.065,
        fcf: 55_000_000,
      })),
      {
        revenueCagr3y: 0.32,
        opPrior: 5_000_000,
        gmChange: 0.02,
        omChange: 0.03,
        cfo: 70_000_000,
        assets: 900_000_000,
        shareGrowth: 0.04,
        rdToRev: 0.18,
        rdGrowth: 0.22,
        roic: 0.09,
        roicChange: 0.02,
        high52w: 52,
        drawdown52w: 0.08,
        customerConcentration: 0.18,
      },
    ),
    snap(
      C2,
      quote(C2, 112, 86_000_000_000, 90_000_000_000, fin({
        revenueTtm: 18_400_000_000,
        revenuePrior: 17_600_000_000,
        operatingIncomeTtm: 3_900_000_000,
        netIncomeTtm: 2_800_000_000,
        cash: 4_200_000_000,
        totalDebt: 8_100_000_000,
        sharesOutstanding: 768_000_000,
        grossMargin: 0.49,
        operatingMargin: 0.21,
        fcf: 2_500_000_000,
      })),
      {
        revenueCagr3y: 0.05,
        opPrior: 3_700_000_000,
        gmChange: 0,
        omChange: 0.005,
        cfo: 3_200_000_000,
        assets: 42_000_000_000,
        shareGrowth: -0.02,
        rdToRev: 0.02,
        roic: 0.16,
        roicChange: 0.01,
        high52w: 118,
        drawdown52w: 0.05,
        customerConcentration: 0.08,
        netDebtEbitda: 0.9,
        interestCoverage: 14,
        cashToAssets: 0.1,
        pe: 30,
      },
    ),
    snap(
      C3,
      quote(C3, 19.4, 3_100_000_000, 4_400_000_000, fin({
        revenueTtm: 2_800_000_000,
        revenuePrior: 3_100_000_000,
        operatingIncomeTtm: 210_000_000,
        netIncomeTtm: 90_000_000,
        cash: 220_000_000,
        totalDebt: 1_500_000_000,
        sharesOutstanding: 160_000_000,
        grossMargin: 0.28,
        operatingMargin: 0.075,
        fcf: -40_000_000,
      })),
      {
        revenueCagr3y: 0.04,
        opPrior: 380_000_000,
        gmChange: -0.03,
        omChange: -0.04,
        cfo: 80_000_000,
        assets: 5_200_000_000,
        shareGrowth: 0.06,
        high52w: 41,
        drawdown52w: 0.53,
        return6m: -0.32,
        customerConcentration: 0.22,
        netDebtEbitda: 4.2,
        interestCoverage: 2.1,
        stDebtToCash: 1.1,
        pe: 12,
        evSales: 1.6,
      },
    ),
    snap(
      C4,
      quote(C4, 28400, 1_900_000_000_000, 1_700_000_000_000, fin({
        revenueTtm: 420_000_000_000,
        revenuePrior: 330_000_000_000,
        operatingIncomeTtm: 48_000_000_000,
        netIncomeTtm: 36_000_000_000,
        cash: 280_000_000_000,
        totalDebt: 40_000_000_000,
        sharesOutstanding: 67_000_000,
        grossMargin: 0.44,
        operatingMargin: 0.114,
        fcf: 22_000_000_000,
      })),
      {
        revenueCagr3y: 0.18,
        opPrior: 21_000_000_000,
        gmChange: 0.01,
        omChange: 0.02,
        cfo: 40_000_000_000,
        assets: 780_000_000_000,
        shareGrowth: 0.03,
        rdToRev: 0.09,
        backlogGrowth: 0.24,
        bookToBill: 1.18,
        roic: 0.11,
        high52w: 36000,
        drawdown52w: 0.21,
        customerConcentration: 0.31,
      },
    ),
    snap(
      C5,
      quote(C5, 41200, 8_400_000_000_000, 7_900_000_000_000, fin({
        revenueTtm: 3_200_000_000_000,
        revenuePrior: 3_050_000_000_000,
        operatingIncomeTtm: 410_000_000_000,
        netIncomeTtm: 300_000_000_000,
        cash: 1_100_000_000_000,
        totalDebt: 400_000_000_000,
        sharesOutstanding: 204_000_000,
        grossMargin: 0.36,
        operatingMargin: 0.128,
        fcf: 240_000_000_000,
      })),
      {
        revenueCagr3y: 0.06,
        opPrior: 390_000_000_000,
        gmChange: 0.004,
        omChange: 0.003,
        cfo: 320_000_000_000,
        assets: 6_200_000_000_000,
        shareGrowth: -0.01,
        roic: 0.13,
        high52w: 44000,
        drawdown52w: 0.06,
        customerConcentration: 0.11,
        interestCoverage: 18,
        cashToAssets: 0.18,
      },
    ),
    snap(
      C6,
      quote(C6, 186000, 5_100_000_000_000, 6_400_000_000_000, fin({
        revenueTtm: 4_800_000_000_000,
        revenuePrior: 5_050_000_000_000,
        operatingIncomeTtm: 220_000_000_000,
        netIncomeTtm: 140_000_000_000,
        cash: 900_000_000_000,
        totalDebt: 2_200_000_000_000,
        sharesOutstanding: 27_400_000,
        grossMargin: 0.18,
        operatingMargin: 0.046,
        fcf: 80_000_000_000,
      })),
      {
        revenueCagr3y: 0.02,
        opPrior: 310_000_000_000,
        gmChange: -0.01,
        omChange: -0.015,
        cfo: 160_000_000_000,
        assets: 9_400_000_000_000,
        shareGrowth: 0.01,
        high52w: 312000,
        drawdown52w: 0.4,
        return6m: -0.22,
        customerConcentration: 0.48,
        netDebtEbitda: 2.8,
        interestCoverage: 4.2,
        pe: 9,
        evSales: 1.3,
      },
    ),
  ];
  return { companies, snapshots };
}
