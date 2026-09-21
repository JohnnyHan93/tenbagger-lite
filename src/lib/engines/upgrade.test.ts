import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DerivedMetrics } from "../metrics/derived.ts";
import type { FinancialSnapshot, FinancialSeries } from "../types.ts";
import { emptyFinancials } from "../research/quote-parse.ts";
import { heuristicDraft } from "../research/heuristic.ts";
import { defaultScenarios, buildTenxMath, buildScenario } from "../tenx/calculator.ts";
import { scoreXBagger } from "./xbagger.ts";
import { opportunityScore, opportunityScorePartial, scoreOversold } from "./oversold.ts";
import { QUALITY_FACTORS, qualityImplStatus, scoreQuality } from "./quality.ts";
import { parseCriteriaPack } from "./criteria/validate.ts";
import { DEFAULT_CRITERIA } from "./criteria/defaults.ts";
import { hashCriteria } from "./criteria/hash.ts";
import { resetActiveCriteria } from "./criteria/active.ts";
import { CRITERIA_RUNTIME } from "./criteria/index.ts";
import { EXECUTE_FULL_100 } from "../research/jobs.ts";
import type { FactorCode } from "../scoring/config.ts";

function fin(extra: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return { ...emptyFinancials(), ...extra };
}

function metrics(group: DerivedMetrics["industryGroup"], extra: Partial<DerivedMetrics> = {}): DerivedMetrics {
  return {
    revenueTtm: 100,
    revenuePrior: 80,
    revenueYoY: 0.25,
    revenueCagr3y: 0.18,
    opTtm: 20,
    opPrior: 14,
    opGrowth: 0.43,
    niTtm: 15,
    gm: 0.72,
    om: 0.2,
    nm: 0.15,
    gmChange: 0.01,
    omChange: 0.02,
    fcf: 12,
    cfo: 16,
    fcfMargin: 0.12,
    cfoMargin: 0.16,
    cashConversion: 1.06,
    accrual: 0.02,
    cash: 40,
    debt: 5,
    netDebt: -35,
    netDebtEbitda: null,
    interestCoverage: 12,
    assets: 80,
    cashToAssets: 0.5,
    stDebtToCash: 0.1,
    shares: 10,
    shareGrowth: 0.01,
    arGrowthGap: 0,
    invGrowthGap: null,
    cccChange: null,
    capex: 4,
    capexToRev: 0.04,
    rdToRev: 0.12,
    rdGrowth: 0.1,
    backlogGrowth: null,
    bookToBill: null,
    roic: 0.18,
    roicChange: 0.02,
    assetTurnover: 1.25,
    drawdown52w: 0.22,
    return3m: -0.08,
    return6m: -0.12,
    marketCap: 500,
    enterpriseValue: 460,
    pe: 20,
    evSales: 4.6,
    evEbitda: 23,
    pb: 4,
    customerConcentration: 0.12,
    industryGroup: group,
    high52w: 12,
    price: 9.4,
    investedCapital: null,
    goingConcernEvidence: false,
    series: null,
    liquidityStress: false,
    ...extra,
  };
}

function allFactors(score: number) {
  const codes: FactorCode[] = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"];
  return codes.map((code) => ({ code, score, reason: "fixture" }));
}

const fy = (period: string, extra: Omit<FinancialSeries["points"][number], "period" | "periodType">): FinancialSeries["points"][number] => ({
  period,
  periodType: "FY",
  ...extra,
});

describe("criteria runtime", () => {
  it("is CRITERIA-v1", () => {
    assert.equal(CRITERIA_RUNTIME, "CRITERIA-v1");
    assert.equal(DEFAULT_CRITERIA.engines.xbagger.version, "XBG-v2.3");
    assert.equal(DEFAULT_CRITERIA.engines.oversold.version, "OSM-v2.3");
    assert.equal(DEFAULT_CRITERIA.engines.quality70.version, "MFC70-v1.5");
  });

  it("hashes engine knobs and ignores overlayId", () => {
    const a = structuredClone(DEFAULT_CRITERIA);
    const b = structuredClone(DEFAULT_CRITERIA);
    b.overlayId = "other";
    b.appliedAt = "2026-09-14";
    assert.equal(hashCriteria(a), hashCriteria(b));
    b.engines.xbagger.hardGates.tenxMin = 9;
    assert.notEqual(hashCriteria(a), hashCriteria(b));
  });

  it("rejects invalid JSON objects", () => {
    assert.equal(parseCriteriaPack(null).ok, false);
    assert.equal(parseCriteriaPack("nope").ok, false);
    assert.equal(parseCriteriaPack({ schema: "idt-criteria-v1" }).ok, false);
  });
});

describe("XBG-v2.2", () => {
  it("does not invent marketCap/20 revenue when revenue is missing", () => {
    const s = defaultScenarios(1e9, fin({ revenueTtm: null, revenuePrior: null }));
    assert.equal(s, null);
    const zero = defaultScenarios(1e9, fin({ revenueTtm: 0 }));
    assert.equal(zero, null);
  });

  it("heuristic F10 is N/A without revenue", () => {
    const d = heuristicDraft({
      ticker: "POOR",
      exchange: "NASDAQ",
      companyName: "Data Poor",
      currency: "USD",
      price: 10,
      marketCap: 1e9,
      enterpriseValue: 1e9,
      country: "US",
      sector: "Technology",
      industry: "Software",
      financials: emptyFinancials(),
    });
    assert.equal(d.factors.find((f) => f.code === "F10")?.score, null);
    assert.equal(d.tenxScenarios.length, 0);
    assert.equal(d.tenxMath?.currentRevenue, null);
  });

  it("tenx math missing → F10 N/A, not High", () => {
    resetActiveCriteria();
    const r = scoreXBagger({
      factors: allFactors(8),
      tenxMath: null,
      tenxScenarios: [],
      tenxFeasibility: "HIGH",
    });
    assert.equal(r.factors.find((f) => f.code === "F10")?.score, null);
    assert.equal(r.f10MathComplete, false);
    assert.equal(r.gates.tenx, "RESEARCH REQUIRED");
    assert.notEqual(r.grade, "S");
  });

  it("narrative F10 cannot exceed math", () => {
    const math = buildTenxMath(1e9, fin({ revenueTtm: 1e8, revenuePrior: 9e7 }), [
      buildScenario({
        scenario: "BEAR",
        revenue: 1e8,
        operatingMargin: 0.1,
        netMargin: 0.05,
        multipleType: "EV_SALES",
        multipleValue: 2,
        currentMarketCap: 1e9,
      }),
      buildScenario({
        scenario: "BASE",
        revenue: 1.1e8,
        operatingMargin: 0.12,
        netMargin: 0.06,
        multipleType: "EV_SALES",
        multipleValue: 2.5,
        currentMarketCap: 1e9,
      }),
      buildScenario({
        scenario: "BULL",
        revenue: 1.2e8,
        operatingMargin: 0.15,
        netMargin: 0.08,
        multipleType: "EV_SALES",
        multipleValue: 3,
        currentMarketCap: 1e9,
      }),
    ]);
    const r = scoreXBagger({
      factors: allFactors(10),
      tenxMath: math,
      tenxScenarios: math ? [math].flatMap(() => [
        buildScenario({
          scenario: "BEAR",
          revenue: 1e8,
          operatingMargin: 0.1,
          netMargin: 0.05,
          multipleType: "EV_SALES",
          multipleValue: 2,
          currentMarketCap: 1e9,
        }),
        buildScenario({
          scenario: "BASE",
          revenue: 1.1e8,
          operatingMargin: 0.12,
          netMargin: 0.06,
          multipleType: "EV_SALES",
          multipleValue: 2.5,
          currentMarketCap: 1e9,
        }),
        buildScenario({
          scenario: "BULL",
          revenue: 1.2e8,
          operatingMargin: 0.15,
          netMargin: 0.08,
          multipleType: "EV_SALES",
          multipleValue: 3,
          currentMarketCap: 1e9,
        }),
      ]) : [],
      tenxFeasibility: "LOW",
    });
    const f10 = r.factors.find((f) => f.code === "F10")?.score;
    assert.ok(f10 == null || f10 < 6);
    assert.equal(r.grade, "F");
    assert.equal(r.gates.tenx, "FAIL");
  });

  it("customer evidence missing is not PASS even with revenue", () => {
    const d = defaultScenarios(1e9, fin({ revenueTtm: 2e8, revenuePrior: 1.5e8 }));
    assert.ok(d);
    const math = buildTenxMath(1e9, fin({ revenueTtm: 2e8, revenuePrior: 1.5e8 }), [d.bear, d.base, d.bull]);
    const r = scoreXBagger({
      factors: allFactors(8),
      tenxMath: math,
      tenxScenarios: [d.bear, d.base, d.bull],
      tenxFeasibility: "POSSIBLE",
      customerEvidence: { named: false, paid: false, repeat: false, retention: false },
    });
    assert.notEqual(r.gates.customer, "PASS");
  });

  it("survival incomplete is RESEARCH REQUIRED not PASS", () => {
    const d = defaultScenarios(1e9, fin({ revenueTtm: 2e8, revenuePrior: 1.5e8, fcf: 10, cash: 20 }));
    assert.ok(d);
    const math = buildTenxMath(1e9, fin({ revenueTtm: 2e8, revenuePrior: 1.5e8 }), [d.bear, d.base, d.bull]);
    const r = scoreXBagger({
      factors: allFactors(8).map((f) => (f.code === "F7" ? { ...f, score: null } : f)),
      tenxMath: math,
      tenxScenarios: [d.bear, d.base, d.bull],
      tenxFeasibility: "POSSIBLE",
      survivalEvidence: { fcf: null, cfo: null, cash: 20, debt: 5 },
      customerEvidence: { named: true, paid: true },
    });
    assert.equal(r.gates.survival, "RESEARCH REQUIRED");
  });
});

describe("OSM-v2.3", () => {
  it("6.80 regression", () => {
    assert.equal(Number(opportunityScore(8, 7, 6, 5).toFixed(2)), 6.8);
  });

  it("renormalizes when O is N/A", () => {
    const p = opportunityScorePartial(8, 7, null, 5);
    assert.equal(Number(p.score?.toFixed(2)), 6.89);
    assert.equal(Number(p.coverage.toFixed(2)), 0.9);
  });

  it("trap can be zero and does not change Opp", () => {
    const clean = scoreOversold(
      metrics("industrial", {
        revenueYoY: 0.12,
        omChange: 0.01,
        netDebtEbitda: 1,
        shareGrowth: 0,
        accrual: 0.02,
        drawdown52w: 0.18,
      }),
    );
    assert.equal(clean.valueTrap, 0);
    const trap = scoreOversold(
      metrics("industrial", {
        revenueYoY: -0.23,
        om: -0.05,
        omChange: -0.1,
        netDebtEbitda: 8,
        shareGrowth: 0.25,
        accrual: 0.2,
        fcf: -20,
        niTtm: -8,
        drawdown52w: 0.62,
      }),
    );
    assert.ok(trap.valueTrap >= 7);
    const sameFvOr = opportunityScore(
      clean.fundamental ?? 0,
      clean.valuation ?? 0,
      clean.oversold ?? 0,
      clean.riskInverse ?? 0,
    );
    assert.equal(clean.opportunity, Number(sameFvOr.toFixed(2)));
    assert.notEqual(trap.opportunity, trap.valueTrap);
  });

  it("REIT does not force manufacturing P/E", () => {
    const o = scoreOversold(metrics("reit", { pe: 8, evSales: null, pb: null, om: 0.4 }));
    assert.equal(o.valuation, null);
    assert.match(o.reasons.valuation, /REIT/);
  });

  it("incomplete Case when fundamentals missing", () => {
    const o = scoreOversold(
      metrics("saas", {
        revenueYoY: null,
        om: null,
        niTtm: null,
        drawdown52w: null,
        return3m: null,
        return6m: null,
      }),
    );
    assert.equal(o.case, null);
    assert.equal(o.caseStatus, "INCOMPLETE");
    assert.equal(o.fundamental, null);
  });

  it("3Y CAGR lifts fundamental versus YoY-only", () => {
    const withCagr = scoreOversold(metrics("saas", { revenueCagr3y: 0.22, revenueYoY: 0.1 }));
    const noCagr = scoreOversold(metrics("saas", { revenueCagr3y: null, revenueYoY: 0.1 }));
    assert.ok((withCagr.fundamental ?? 0) > (noCagr.fundamental ?? 0));
  });

  it("latest NI at a 3Y max raises peak earnings when revenue is falling", () => {
    const base = {
      revenueYoY: -0.05,
      om: 0.1,
      omChange: 0,
      pe: 20,
      cashConversion: 0.9,
      accrual: 0.02,
      fcf: 10,
      niTtm: 12,
    };
    const none = scoreOversold(metrics("industrial", { ...base, series: null }));
    assert.equal(none.peakEarningsLevel, "NONE");
    const series: FinancialSeries = {
      points: [fy("2023", { netIncome: 4 }), fy("2024", { netIncome: 8 }), fy("2025", { netIncome: 12 })],
    };
    const peak = scoreOversold(metrics("industrial", { ...base, series }));
    assert.equal(peak.peakEarningsLevel, "POSSIBLE");
  });
});

describe("MFC70-v1.5 cash runway", () => {
  it("Q57 uses cash runway when FCF is negative and does not invent cash", () => {
    const self = scoreQuality(metrics("saas", { fcf: 12, cash: 40, opTtm: 20 }));
    assert.equal(self.factors.find((f) => f.id === "Q57")?.score, 8);

    const long = scoreQuality(metrics("saas", { fcf: -10, cash: 40, opTtm: -2, runwayYears: 4 }));
    assert.equal(long.factors.find((f) => f.id === "Q57")?.score, 5);

    const short = scoreQuality(metrics("saas", { fcf: -20, cash: 8, opTtm: -5, runwayYears: 0.4, liquidityStress: true }));
    assert.equal(short.factors.find((f) => f.id === "Q57")?.score, 1);
    assert.ok(short.operationalFlags.includes("CASH_RUNWAY_SHORT"));

    const unknown = scoreQuality(metrics("saas", { fcf: -10, cash: null, opTtm: -2, runwayYears: null }));
    assert.equal(unknown.factors.find((f) => f.id === "Q57")?.score, 3);
  });

  it("still has exactly 70 factors and does not mix 74", () => {
    assert.equal(QUALITY_FACTORS.length, 70);
    assert.equal(DEFAULT_CRITERIA.engines.quality70.version, "MFC70-v1.5");
  });
});

describe("MFC70-v1.4", () => {
  it("has exactly 70 factors", () => {
    assert.equal(QUALITY_FACTORS.length, 70);
  });

  it("Q37 is N/A without invested capital and is not Q39", () => {
    const q = scoreQuality(metrics("saas", { investedCapital: null, assetTurnover: 1.4, revenueTtm: 100 }));
    const q37 = q.factors.find((f) => f.id === "Q37");
    const q39 = q.factors.find((f) => f.id === "Q39");
    assert.equal(q37?.score, null);
    assert.equal(q37?.missingReason, "MISSING_FIELD");
    assert.notEqual(q39?.score, null);
    const withIc = scoreQuality(metrics("saas", { investedCapital: 80, revenueTtm: 100, assetTurnover: 1.4 }));
    assert.notEqual(withIc.factors.find((f) => f.id === "Q37")?.score, null);
    assert.notEqual(withIc.factors.find((f) => f.id === "Q37")?.score, withIc.factors.find((f) => f.id === "Q39")?.score);
  });

  it("Q70 is N/A without going-concern evidence", () => {
    const q = scoreQuality(metrics("saas", { goingConcernEvidence: false, fcf: -10, cash: 1, liquidityStress: true }));
    const q70 = q.diagnostics.find((f) => f.id === "Q70") ?? q.factors.find((f) => f.id === "Q70");
    assert.equal(q70?.score, null);
    assert.equal(q70?.missingReason, "MISSING_TIER_1_2_EVIDENCE");
    assert.ok(q.operationalFlags.includes("LIQUIDITY_STRESS"));
  });

  it("diagnostics stay out of base score", () => {
    const q = scoreQuality(metrics("saas"));
    assert.ok(q.diagnostics.every((d) => d.kind === "Diagnostic"));
    const diagIds = new Set(q.diagnostics.map((d) => d.id));
    assert.ok(!q.factors.filter((f) => f.kind !== "Diagnostic").some((f) => diagIds.has(f.id) && f.status === "DIAGNOSTIC" && f.kind !== "Diagnostic"));
    const eligible = q.factors.filter((f) => f.kind !== "Diagnostic" && f.applicability !== "N" && f.applicability !== "R");
    assert.equal(q.eligibleCount, eligible.length);
  });

  it("Q07 uses actual quarter series, not TTM", () => {
    const series: FinancialSeries = {
      points: [
        { period: "2025Q3", periodType: "Q", revenue: 100 },
        { period: "2025Q4", periodType: "Q", revenue: 115 },
      ],
    };
    const q = scoreQuality(metrics("saas", { series, revenueYoY: -0.5 }));
    const q07 = q.factors.find((f) => f.id === "Q07");
    assert.notEqual(q07?.score, null);
    const none = scoreQuality(metrics("saas", { series: null, revenueYoY: 0.4 }));
    assert.equal(none.factors.find((f) => f.id === "Q07")?.score, null);
    assert.equal(none.factors.find((f) => f.id === "Q07")?.missingReason, "MISSING_SERIES");
  });

  it("Q20 uses 3Y FCF series and refuses 1Y FCF", () => {
    const oneYear = scoreQuality(metrics("saas", { fcf: 50, series: null }));
    assert.equal(oneYear.factors.find((f) => f.id === "Q20")?.score, null);
    const series: FinancialSeries = {
      points: [
        fy("2023", { fcf: 10 }),
        fy("2024", { fcf: 12 }),
        fy("2025", { fcf: 16 }),
      ],
    };
    const three = scoreQuality(metrics("saas", { fcf: -99, series }));
    assert.notEqual(three.factors.find((f) => f.id === "Q20")?.score, null);
  });

  it("Q21 uses CFO series", () => {
    const none = scoreQuality(metrics("saas", { cfo: 40, series: null }));
    assert.equal(none.factors.find((f) => f.id === "Q21")?.score, null);
    const series: FinancialSeries = {
      points: [fy("2024", { cfo: 10 }), fy("2025", { cfo: 13 })],
    };
    const q = scoreQuality(metrics("saas", { series }));
    assert.notEqual(q.factors.find((f) => f.id === "Q21")?.score, null);
  });

  it("Q54 uses 3Y diluted shares and refuses 1Y proxy", () => {
    const oneY = scoreQuality(metrics("saas", { shareGrowth: 0.5, series: null }));
    assert.equal(oneY.factors.find((f) => f.id === "Q54")?.score, null);
    assert.equal(oneY.factors.find((f) => f.id === "Q54")?.missingReason, "MISSING_SERIES");
    const series: FinancialSeries = {
      points: [
        fy("2023", { dilutedShares: 100 }),
        fy("2024", { dilutedShares: 102 }),
        fy("2025", { dilutedShares: 103 }),
      ],
    };
    const three = scoreQuality(metrics("saas", { shareGrowth: 0.5, series }));
    assert.notEqual(three.factors.find((f) => f.id === "Q54")?.score, null);
  });

  it("Q40 / Q38 / Q22 score from series, not 1Y proxies", () => {
    const none = scoreQuality(metrics("industrial", { series: null, capex: null, investedCapital: null, cfo: 40 }));
    assert.equal(none.factors.find((f) => f.id === "Q40")?.score, null);
    assert.equal(none.factors.find((f) => f.id === "Q38")?.score, null);
    assert.equal(none.factors.find((f) => f.id === "Q22")?.score, null);
    assert.equal(none.factors.find((f) => f.id === "Q22")?.missingReason, "MISSING_SERIES");
    assert.equal(none.factors.find((f) => f.id === "Q04")?.missingReason, "MISSING_SERIES");
    const series: FinancialSeries = {
      points: [
        fy("2023", { ppe: 40, investedCapital: 80, operatingIncome: 8, cfo: 6, capex: -5, revenue: 70, epsDiluted: 0.4, debt: 20 }),
        fy("2024", { ppe: 44, investedCapital: 90, operatingIncome: 12, cfo: 9, capex: -6, revenue: 85, epsDiluted: 0.55, debt: 22 }),
        fy("2025", { ppe: 48, investedCapital: 100, operatingIncome: 18, cfo: 14, capex: -7, revenue: 100, epsDiluted: 0.8, debt: 24 }),
      ],
    };
    const q = scoreQuality(metrics("industrial", { series, revenueTtm: 100, revenuePrior: 85, revenueYoY: 100 / 85 - 1, capex: 7 }));
    assert.notEqual(q.factors.find((f) => f.id === "Q40")?.score, null);
    assert.notEqual(q.factors.find((f) => f.id === "Q38")?.score, null);
    assert.equal(q.factors.find((f) => f.id === "Q22")?.score, 10);
    assert.notEqual(q.factors.find((f) => f.id === "Q04")?.score, null);
    assert.notEqual(q.factors.find((f) => f.id === "Q45")?.score, null);
  });
});

describe("fixtures — three engines stay separate", () => {
  it("high-quality SaaS", () => {
    const series: FinancialSeries = {
      points: [
        fy("2023", { fcf: 8, cfo: 10, dilutedShares: 100, revenue: 70 }),
        fy("2024", { fcf: 10, cfo: 12, dilutedShares: 101, revenue: 85 }),
        fy("2025", { fcf: 14, cfo: 16, dilutedShares: 102, revenue: 100 }),
        { period: "2025Q3", periodType: "Q", revenue: 24 },
        { period: "2025Q4", periodType: "Q", revenue: 28 },
      ],
    };
    const m = metrics("saas", { investedCapital: 70, series });
    const q = scoreQuality(m);
    const o = scoreOversold(m);
    assert.ok(q.score != null && q.score > 50);
    assert.ok(o.opportunity != null);
    assert.notEqual(q.score, o.opportunity);
    assert.ok(q.coreCoverage > q.conditionalCoverage || q.conditionalCoverage >= 0);
  });

  it("loss-making speculative tech", () => {
    const m = metrics("saas", {
      om: -0.8,
      nm: -0.9,
      fcf: -40,
      cfo: -30,
      cash: 80,
      debt: 0,
      pe: null,
      niTtm: -50,
      revenueYoY: 0.8,
    });
    const o = scoreOversold(m);
    assert.ok(o.fundamental != null);
    assert.ok(o.valueTrap >= 0);
  });

  it("value trap industrial", () => {
    const o = scoreOversold(
      metrics("industrial", {
        revenueYoY: -0.2,
        om: 0.28,
        omChange: -0.08,
        pe: 6,
        evSales: 1.2,
        fcf: -5,
        niTtm: 12,
        cashConversion: 0.3,
        accrual: 0.2,
        netDebtEbitda: 5,
        shareGrowth: 0.22,
        drawdown52w: 0.55,
      }),
    );
    assert.ok(o.valueTrap >= 7);
    assert.ok(o.peakEarningsLevel === "HIGH" || o.peakEarningsLevel === "POSSIBLE");
  });

  it("REIT and financial adapters", () => {
    const reit = scoreOversold(metrics("reit", { pe: 7, evSales: 12, pb: 0.9 }));
    const bank = scoreOversold(metrics("financial", { pe: 7, evSales: 12, pb: 0.8 }));
    assert.ok(reit.reasons.valuation.includes("P/B") || reit.valuation != null);
    assert.ok(bank.reasons.valuation.includes("P/B") || bank.valuation != null);
  });

  it("data-poor company stays N/A", () => {
    const q = scoreQuality({ industryGroup: "saas" } as DerivedMetrics);
    assert.ok(q.scoredCount < q.eligibleCount);
    assert.ok(q.score == null || q.coverage < 1);
    const o = scoreOversold({ industryGroup: "saas" } as DerivedMetrics);
    assert.equal(o.caseStatus, "INCOMPLETE");
  });
});

describe("integrity", () => {
  it("EXECUTE_FULL_100 stays locked after the Neon batch", () => {
    assert.equal(EXECUTE_FULL_100, false);
  });

  it("manual-only count is honest", () => {
    const manual = QUALITY_FACTORS.filter((f) => qualityImplStatus(f.id, f.kind) === "MANUAL_ONLY");
    assert.ok(manual.length >= 20);
    assert.ok(manual.length <= 32);
    assert.ok(!manual.some((f) => ["Q07", "Q20", "Q21", "Q54", "Q37", "Q70", "Q04", "Q35", "Q38", "Q40", "Q42", "Q45"].includes(f.id)));
  });
});
