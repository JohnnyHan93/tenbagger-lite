import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opportunityScore, scoreOversold } from "./oversold.ts";
import type { DerivedMetrics } from "../metrics/derived.ts";
import { QUALITY_FACTORS, scoreQuality } from "./quality.ts";
import { scoreXBagger } from "./xbagger.ts";
import { applyCoverage, weightedObserved } from "./coverage.ts";
import { parseTickerList } from "../universe/parse.ts";
import { defaultScenarios } from "../tenx/calculator.ts";

describe("oversold formula", () => {
  it("Opp = 0.40F + 0.25V + 0.10O + 0.25R", () => {
    const opp = opportunityScore(8, 7, 6, 5);
    assert.equal(Number(opp.toFixed(2)), 6.8);
  });
});

describe("xbagger coverage", () => {
  it("N/A is excluded from denominator", () => {
    const w = weightedObserved([
      { score: 10, weight: 50 },
      { score: null, weight: 50 },
    ]);
    assert.equal(w.coverage, 0.5);
    assert.equal(w.normalized, 100);
  });

  it("coverage <70 is RESEARCH REQUIRED", () => {
    const cov = applyCoverage(80, 0.6);
    assert.equal(cov.status, "RESEARCH REQUIRED");
  });

  it("hard gate FAIL forces F", () => {
    const d = defaultScenarios(1e9, {
      revenueTtm: 1e8,
      revenuePrior: 8e7,
      operatingIncomeTtm: 1e7,
      netIncomeTtm: 5e6,
      cash: 2e8,
      totalDebt: 0,
      sharesOutstanding: 1e8,
      grossMargin: 0.6,
      operatingMargin: 0.1,
      fcf: 1e7,
    });
    const r = scoreXBagger({
      factors: [
        { code: "F1", score: 8, reason: "tam" },
        { code: "F2", score: 8, reason: "g" },
        { code: "F3", score: 8, reason: "s" },
        { code: "F4", score: 8, reason: "t" },
        { code: "F5", score: 8, reason: "m" },
        { code: "F6", score: 8, reason: "c" },
        { code: "F7", score: 8, reason: "cash" },
        { code: "F8", score: 8, reason: "v" },
        { code: "F9", score: 8, reason: "k" },
        { code: "F10", score: 2, reason: "math fail" },
      ],
      tenxMath: null,
      tenxScenarios: [d.bear, d.base, d.bull],
      tenxFeasibility: "LOW",
    });
    assert.equal(r.grade, "F");
    assert.equal(r.gates.tenx, "FAIL");
  });
});

describe("quality 70", () => {
  it("has 70 factors", () => {
    assert.equal(QUALITY_FACTORS.length, 70);
  });

  it("N/A is not zero and diagnostics stay out of base", () => {
    const m = {
      revenueTtm: 100,
      revenuePrior: 80,
      revenueYoY: 0.25,
      revenueCagr3y: null,
      opTtm: 10,
      opPrior: null,
      opGrowth: null,
      niTtm: 8,
      gm: 0.7,
      om: 0.1,
      nm: 0.08,
      gmChange: null,
      omChange: null,
      fcf: 5,
      cfo: 6,
      fcfMargin: 0.05,
      cfoMargin: 0.06,
      cashConversion: 0.75,
      accrual: null,
      cash: 40,
      debt: 5,
      netDebt: -35,
      netDebtEbitda: null,
      interestCoverage: null,
      assets: 80,
      cashToAssets: 0.5,
      stDebtToCash: null,
      shares: 10,
      shareGrowth: 0.02,
      arGrowthGap: null,
      invGrowthGap: null,
      cccChange: null,
      capex: null,
      capexToRev: null,
      rdToRev: 0.1,
      rdGrowth: null,
      backlogGrowth: null,
      bookToBill: null,
      roic: null,
      roicChange: null,
      assetTurnover: 1.2,
      drawdown52w: 0.1,
      return3m: null,
      return6m: null,
      marketCap: 500,
      enterpriseValue: 460,
      pe: 20,
      evSales: 4.6,
      evEbitda: null,
      pb: null,
      customerConcentration: 0.2,
      industryGroup: "saas" as const,
      high52w: 12,
      price: 10,
    };
    const q = scoreQuality(m);
    assert.ok(q.eligibleCount > 0);
    assert.ok(q.scoredCount < q.eligibleCount);
    assert.ok(q.score != null && q.score > 0);
    assert.equal(q.diagnostics.every((d) => d.kind === "Diagnostic"), true);
    const inv = q.factors.find((f) => f.id === "Q26");
    assert.equal(inv?.applicability, "N");
  });
});

describe("universe import", () => {
  it("parses markdown table and rejects junk", () => {
    const md = `| Ticker | Name |\n| --- | --- |\n| INOD | Innodata |\n| DSP | Viant |\n| !!! | bad |`;
    const p = parseTickerList(md);
    assert.deepEqual(p.tickers.map((t) => t.ticker), ["INOD", "DSP"]);
    assert.ok(p.errors.length >= 1);
  });
});

describe("oversold value trap separate", () => {
  it("does not fold VT into opportunity", () => {
    const m: DerivedMetrics = {
      revenueTtm: 100,
      revenuePrior: 130,
      revenueYoY: -0.23,
      revenueCagr3y: -0.1,
      opTtm: -5,
      opPrior: 20,
      opGrowth: -1,
      niTtm: -8,
      gm: 0.2,
      om: -0.05,
      nm: -0.08,
      gmChange: -0.08,
      omChange: -0.1,
      fcf: -20,
      cfo: -12,
      fcfMargin: -0.2,
      cfoMargin: -0.12,
      cashConversion: null,
      accrual: 0.2,
      cash: 10,
      debt: 80,
      netDebt: 70,
      netDebtEbitda: 8,
      interestCoverage: 0.4,
      assets: 120,
      cashToAssets: 0.08,
      stDebtToCash: 3,
      shares: 20,
      shareGrowth: 0.25,
      arGrowthGap: 0.2,
      invGrowthGap: 0.3,
      cccChange: 20,
      capex: 5,
      capexToRev: 0.05,
      rdToRev: null,
      rdGrowth: null,
      backlogGrowth: null,
      bookToBill: null,
      roic: 0.01,
      roicChange: -0.05,
      assetTurnover: 0.8,
      drawdown52w: 0.62,
      return3m: -0.3,
      return6m: -0.4,
      marketCap: 200,
      enterpriseValue: 270,
      pe: null,
      evSales: 2.7,
      evEbitda: null,
      pb: 0.8,
      customerConcentration: 0.5,
      industryGroup: "industrial",
      high52w: 50,
      price: 19,
    };
    const o = scoreOversold(m);
    assert.ok(o.valueTrap >= 7);
    assert.equal(o.case, "C");
    assert.ok(o.opportunity != null);
  });
});
