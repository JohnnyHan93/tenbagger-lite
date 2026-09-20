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
  const upside = input.currentMarketCap > 0 ? implied / input.currentMarketCap : 0;
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

export function requiredNetIncomeFor10x(currentMarketCap: number, pe: number): number | null {
  if (pe <= 0) return null;
  return targetMarketCap(currentMarketCap) / pe;
}

export function requiredPeFor10x(currentMarketCap: number, futureNetIncome: number): number | null {
  if (futureNetIncome <= 0) return null;
  return targetMarketCap(currentMarketCap) / futureNetIncome;
}

export function requiredEvSalesFor10x(currentMarketCap: number, futureRevenue: number): number | null {
  if (futureRevenue <= 0) return null;
  return targetMarketCap(currentMarketCap) / futureRevenue;
}

export function compound(start: number, cagr: number, years: number): number {
  return start * Math.pow(1 + cagr, years);
}

export function impliedCagr(start: number, end: number, years: number): number | null {
  if (start <= 0 || end <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

/**
 * Real revenue only. Never invents marketCap/20 or a default 25% growth.
 * Returns null when revenue is missing so F10 stays N/A.
 */
export function defaultScenarios(
  marketCap: number,
  financials: FinancialSnapshot,
): { bear: TenxScenario; base: TenxScenario; bull: TenxScenario } | null {
  const currentRev = financials.revenueTtm != null && financials.revenueTtm > 0 ? financials.revenueTtm : null;
  if (currentRev == null || marketCap <= 0) return null;
  const growth =
    financials.revenuePrior != null && financials.revenuePrior > 0
      ? currentRev / financials.revenuePrior - 1
      : null;
  // No observed growth → no scenario pack. Required CAGR still lives on TenxMath.
  if (growth == null || !Number.isFinite(growth)) return null;
  const observed = growth;
  const baseCagr = Math.min(0.35, Math.max(0.0, observed * 0.6));
  const bullCagr = Math.min(0.5, Math.max(baseCagr, observed));
  const bearCagr = Math.max(0, baseCagr * 0.4);
  const om = financials.operatingMargin;
  const nm = financials.netIncomeTtm != null && currentRev > 0 ? financials.netIncomeTtm / currentRev : null;
  return {
    bear: buildScenario({
      scenario: "BEAR",
      revenue: compound(currentRev, bearCagr, 5),
      operatingMargin: om != null && om > 0 ? Math.min(om, 0.08) : 0.08,
      netMargin: nm != null && nm > 0 ? Math.min(nm, 0.05) : 0.05,
      multipleType: "EV_SALES",
      multipleValue: 4,
      currentMarketCap: marketCap,
    }),
    base: buildScenario({
      scenario: "BASE",
      revenue: compound(currentRev, baseCagr, 6),
      operatingMargin: om != null && om > 0 ? Math.min(Math.max(om, 0.1), 0.18) : 0.18,
      netMargin: nm != null && nm > 0 ? Math.min(Math.max(nm, 0.06), 0.12) : 0.12,
      multipleType: "EV_SALES",
      multipleValue: 8,
      currentMarketCap: marketCap,
    }),
    bull: buildScenario({
      scenario: "BULL",
      revenue: compound(currentRev, bullCagr, 7),
      operatingMargin: om != null && om > 0 ? Math.min(om + 0.1, 0.28) : 0.28,
      netMargin: nm != null && nm > 0 ? Math.min(nm + 0.08, 0.2) : 0.2,
      multipleType: "EV_SALES",
      multipleValue: 12,
      currentMarketCap: marketCap,
    }),
  };
}

export function buildTenxMath(
  marketCap: number,
  financials: FinancialSnapshot,
  scenarios: TenxScenario[],
): TenxMath {
  const currentRev = financials.revenueTtm != null && financials.revenueTtm > 0 ? financials.revenueTtm : null;
  const growth =
    currentRev != null && financials.revenuePrior != null && financials.revenuePrior > 0
      ? currentRev / financials.revenuePrior - 1
      : null;
  const bull = scenarios.find((s) => s.scenario === "BULL") ?? scenarios.at(-1);
  const exitMultiple = bull?.multipleValue ?? null;
  const matureMargin = bull?.netMargin ?? null;
  const assumedCagr = growth;
  const revenue5y = currentRev != null && assumedCagr != null ? compound(currentRev, Math.min(0.5, Math.max(-0.5, assumedCagr)), 5) : null;
  const revenue7y = currentRev != null && assumedCagr != null ? compound(currentRev, Math.min(0.5, Math.max(-0.5, assumedCagr)), 7) : null;
  const implied = bull?.impliedMarketCap ?? (revenue7y != null && exitMultiple != null ? revenue7y * exitMultiple : null);
  const vsToday = implied != null && marketCap > 0 ? implied / marketCap : null;
  const reqRev = requiredRevenueFor10x(marketCap, "EV_SALES", exitMultiple ?? 8, matureMargin ?? 0.12);
  const reqNi = requiredNetIncomeFor10x(marketCap, 20);
  const reqPe = financials.netIncomeTtm != null ? requiredPeFor10x(marketCap, financials.netIncomeTtm) : null;
  const reqEvS = currentRev != null ? requiredEvSalesFor10x(marketCap, currentRev) : null;
  const reqCagr = currentRev != null && reqRev != null ? impliedCagr(currentRev, reqRev, 7) : null;
  let path: TenxPath = "Implausible";
  if (currentRev == null) path = "Implausible";
  else if (vsToday != null && vsToday >= 8) path = "Plausible";
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
    requiredRevenue: reqRev,
    requiredNetIncome: reqNi,
    requiredPe: reqPe,
    requiredEvSales: reqEvS,
    requiredCagr: reqCagr,
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
  if (!scenarios.length || f10 == null) return "UNREALISTIC";
  const best = Math.max(...scenarios.map((s) => s.upsideMultiple), 0);
  if (f10 >= 8 && best >= 8) return "HIGH";
  if (f10 >= 6 && best >= 5) return "POSSIBLE";
  if (best >= 3 || f10 >= 4) return "LOW";
  return "UNREALISTIC";
}

export function f10FromMath(
  tenxMath: TenxMath | null,
  scenarios: TenxScenario[],
): { score: number | null; reason: string } {
  if (!tenxMath || tenxMath.currentRevenue == null || scenarios.length === 0) {
    return { score: null, reason: "매출 시계열 없음. synthetic 10x 경로를 만들지 않음. F10=N/A." };
  }
  if (tenxMath.assumedCagr == null) {
    return {
      score: null,
      reason: "관측 성장률 없음. 0%·고정 EV/S로 F10을 만들지 않음. 필요 CAGR만 표시. F10=N/A.",
    };
  }
  const bull = scenarios.find((s) => s.scenario === "BULL");
  const base = scenarios.find((s) => s.scenario === "BASE");
  if (!bull || !base) {
    return { score: null, reason: "Tenx 시나리오 없음. F10=N/A." };
  }
  const score = scoreTenxFromUpside(bull.upsideMultiple, base.upsideMultiple);
  return {
    score,
    reason: `Bull ${bull.upsideMultiple.toFixed(1)}x · Base ${base.upsideMultiple.toFixed(1)}x · 필요매출 경로 ${tenxMath.path}.`,
  };
}
