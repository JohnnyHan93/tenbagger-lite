import type { TenxFeasibility } from "../scoring/config.ts";
import type { FinancialSnapshot, TenxScenario } from "../types.ts";


export function targetMarketCap(current: number): number {
  return current * 10;
}

export function impliedFromEarnings(
  netIncome: number,
  pe: number,
): number {
  return netIncome * pe;
}

export function impliedFromSales(revenue: number, evSales: number): number {
  return revenue * evSales;
}

export function buildScenario(input: {
  scenario: "BASE" | "BULL";
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

export function defaultScenarios(
  marketCap: number,
  financials: FinancialSnapshot,
): { base: TenxScenario; bull: TenxScenario } {
  const currentRev = financials.revenueTtm && financials.revenueTtm > 0
    ? financials.revenueTtm
    : marketCap / 20;
  const baseRev = currentRev * 6;
  const bullRev = currentRev * 12;
  const base = buildScenario({
    scenario: "BASE",
    revenue: baseRev,
    operatingMargin: 0.18,
    netMargin: 0.12,
    multipleType: "EV_SALES",
    multipleValue: 8,
    currentMarketCap: marketCap,
  });
  const bull = buildScenario({
    scenario: "BULL",
    revenue: bullRev,
    operatingMargin: 0.28,
    netMargin: 0.2,
    multipleType: "EV_SALES",
    multipleValue: 12,
    currentMarketCap: marketCap,
  });
  return { base, bull };
}

export function feasibilityFromMath(
  scenarios: TenxScenario[],
  f10: number,
  tenxFlagRed: boolean,
): TenxFeasibility {
  if (tenxFlagRed) return "UNREALISTIC";
  const best = Math.max(...scenarios.map((s) => s.upsideMultiple), 0);
  if (f10 >= 2 && best >= 8) return "HIGH";
  if (f10 >= 1 && best >= 4) return "POSSIBLE";
  if (best >= 2 || f10 >= 1) return "LOW";
  return "UNREALISTIC";
}
