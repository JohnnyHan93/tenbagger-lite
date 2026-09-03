import type { TenxFeasibility, TenxPath } from "../scoring/config.ts";
import type { FinancialSnapshot, TenxMath, TenxScenario } from "../types.ts";


export function targetMarketCap(current: number): number {
  return current * 10;
}

export function impliedFromEarnings(netIncome: number, pe: number): number {
  return netIncome * pe;
}

export function impliedFromSales(revenue: number, evSales: number): number {
  return revenue * evSales;
}

export function buildScenario(input: {
  scenario: "BEAR" | "BASE" | "BULL";
  revenue: number;
  operatingMargin: number;
  netMargin: number;
  multipleType: "PE" | "EV_SALES";
  multipleValue: number;
  currentMarketCap: number;
}): TenxScenario {
  const netIncome = input.revenue * input.netMargin;
  const implied =
    input.multipleType === "PE"
      ? impliedFromEarnings(netIncome, input.multipleValue)
      : impliedFromSales(input.revenue, input.multipleValue);
  const upside =
    input.currentMarketCap > 0 ? implied / input.currentMarketCap : 0;
  return {
    scenario: input.scenario,
    revenue: input.revenue,
    operatingMargin: input.operatingMargin,
    netMargin: input.netMargin,
    netIncome,
    multipleType: input.multipleType,
    multipleValue: input.multipleValue,
    impliedMarketCap: implied,
    upsideMultiple: upside,
  };
}

export function requiredRevenueFor10x(
  currentMarketCap: number,
  multipleType: "PE" | "EV_SALES",
  multipleValue: number,
  netMargin: number,
): number | null {
  const target = targetMarketCap(currentMarketCap);
  if (multipleValue <= 0) return null;
  if (multipleType === "EV_SALES") return target / multipleValue;
  if (netMargin <= 0) return null;
  return target / multipleValue / netMargin;
}

export function requiredNetIncomeFor10x(
  currentMarketCap: number,
  pe: number,
): number | null {
  if (pe <= 0) return null;
  return targetMarketCap(currentMarketCap) / pe;
}

export function requiredPeFor10x(
  currentMarketCap: number,
  futureNetIncome: number,
): number | null {
  if (futureNetIncome <= 0) return null;
  return targetMarketCap(currentMarketCap) / futureNetIncome;
}

export function requiredEvSalesFor10x(
  currentMarketCap: number,
  futureRevenue: number,
): number | null {
  if (futureRevenue <= 0) return null;
  return targetMarketCap(currentMarketCap) / futureRevenue;
}

export function compound(start: number, cagr: number, years: number): number {
  return start * Math.pow(1 + cagr, years);
}

export function defaultScenarios(
  marketCap: number,
  financials: FinancialSnapshot,
): { bear: TenxScenario; base: TenxScenario; bull: TenxScenario } {
  const currentRev =
    financials.revenueTtm && financials.revenueTtm > 0
      ? financials.revenueTtm
      : marketCap / 20;
  const growth =
    financials.revenueTtm && financials.revenuePrior && financials.revenuePrior > 0
      ? financials.revenueTtm / financials.revenuePrior - 1
      : 0.25;
  const baseCagr = Math.min(0.35, Math.max(0.08, growth * 0.6));
  const bullCagr = Math.min(0.5, Math.max(baseCagr, growth));
  const bearCagr = Math.max(0.03, baseCagr * 0.4);
  const bear = buildScenario({
    scenario: "BEAR",
    revenue: compound(currentRev, bearCagr, 5),
    operatingMargin: 0.08,
    netMargin: 0.05,
    multipleType: "EV_SALES",
    multipleValue: 4,
    currentMarketCap: marketCap,
  });
  const base = buildScenario({
    scenario: "BASE",
    revenue: compound(currentRev, baseCagr, 6),
    operatingMargin: 0.18,
    netMargin: 0.12,
    multipleType: "EV_SALES",
    multipleValue: 8,
    currentMarketCap: marketCap,
  });
  const bull = buildScenario({
    scenario: "BULL",
    revenue: compound(currentRev, bullCagr, 7),
    operatingMargin: 0.28,
    netMargin: 0.2,
    multipleType: "EV_SALES",
    multipleValue: 12,
    currentMarketCap: marketCap,
  });
  return { bear, base, bull };
}

export function buildTenxMath(
  marketCap: number,
  financials: FinancialSnapshot,
  scenarios: TenxScenario[],
): TenxMath {
  const currentRev = financials.revenueTtm && financials.revenueTtm > 0 ? financials.revenueTtm : null;
  const growth =
    currentRev && financials.revenuePrior && financials.revenuePrior > 0
      ? currentRev / financials.revenuePrior - 1
      : null;
  const assumedCagr = growth != null ? Math.min(0.5, Math.max(0.05, growth * 0.7)) : 0.25;
  const revenue5y = currentRev != null ? compound(currentRev, assumedCagr, 5) : null;
  const revenue7y = currentRev != null ? compound(currentRev, assumedCagr, 7) : null;
  const bull = scenarios.find((s) => s.scenario === "BULL") ?? scenarios.at(-1);
  const exitMultiple = bull?.multipleValue ?? 8;
  const matureMargin = bull?.netMargin ?? 0.12;
  const implied = bull?.impliedMarketCap ?? (revenue7y != null ? revenue7y * exitMultiple : null);
  const vsToday = implied != null && marketCap > 0 ? implied / marketCap : null;
  let path: TenxPath = "Implausible";
  if (vsToday != null && vsToday >= 8) path = "Plausible";
  else if (vsToday != null && vsToday >= 4) path = "Borderline";
  return {
    currentMarketCap: marketCap,
    targetMarketCap: targetMarketCap(marketCap),
    currentRevenue: currentRev,
    assumedCagr,
    revenue5y,
    revenue7y,
    matureMargin,
    exitMultiple,
    impliedFutureMarketCap: implied,
    impliedMultipleVsToday: vsToday,
    path,
  };
}

export function scoreTenxFromUpside(bullUpside: number, baseUpside: number): number {
  if (bullUpside < 3) return 0;
  if (bullUpside < 4) return 2;
  if (bullUpside < 5) return 4;
  if (bullUpside < 7) return 6;
  if (baseUpside >= 8 || bullUpside >= 10) return 10;
  if (bullUpside >= 7) return 8;
  return 4;
}

export function feasibilityFromMath(
  scenarios: TenxScenario[],
  f10: number | null,
  tenxFlagRed: boolean,
): TenxFeasibility {
  if (tenxFlagRed) return "UNREALISTIC";
  const best = Math.max(...scenarios.map((s) => s.upsideMultiple), 0);
  const score = f10 ?? 0;
  if (score >= 8 && best >= 8) return "HIGH";
  if (score >= 6 && best >= 5) return "POSSIBLE";
  if (best >= 3 || score >= 4) return "LOW";
  return "UNREALISTIC";
}
