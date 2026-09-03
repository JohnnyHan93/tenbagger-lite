import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FactorScore, RedFlag } from "../types.ts";
import type { FactorCode } from "./config.ts";
import { FACTOR_WEIGHT, GRADE_THRESHOLDS } from "./config.ts";
import {
  adjustedWildcardScore,
  evaluateHardGates,
  factorTotal,
  gradeFromScore,
  rawWildcardScore,
  scoreAnalysis,
  weightedTotal,
} from "./wildcard-score.ts";
import { makeFlag } from "../risk/flags.ts";
import { targetMarketCap, requiredRevenueFor10x } from "../tenx/calculator.ts";


function scores(values: number[]): FactorScore[] {
  return values.map((score, i) => {
    const factorCode = `F${i + 1}` as FactorCode;
    const weight = FACTOR_WEIGHT[factorCode];
    return {
      factorCode,
      score,
      weight,
      weightedScore: (score / 10) * weight,
      evidenceSummary: "",
      confidence: "Medium",
      originalScore: score,
      overrideScore: null,
      overrideReason: null,
      overrideDate: null,
    };
  });
}

function flags(list: RedFlag[] = []): RedFlag[] {
  return list;
}

describe("weighted wildcard score", () => {
  it("all 10s → weighted 100", () => {
    const s = scores(Array(10).fill(10));
    assert.equal(factorTotal(s), 100);
    assert.equal(weightedTotal(s), 100);
    assert.equal(rawWildcardScore(weightedTotal(s)), 100);
  });
  it("applies factor weights", () => {
    const v = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    assert.equal(weightedTotal(scores(v)), 12);
  });
});

describe("grades", () => {
  it("85+ is S", () => {
    assert.equal(gradeFromScore(85, false), "S");
    assert.ok(GRADE_THRESHOLDS.S === 85);
  });
  it("hard stop is F", () => {
    assert.equal(gradeFromScore(90, true), "F");
  });
});

describe("hard gates", () => {
  it("10x Math < 6 → FAIL even if total is high", () => {
    const v = [10, 10, 10, 10, 10, 10, 10, 10, 10, 4];
    const r = scoreAnalysis(scores(v), flags());
    assert.equal(r.hardGates.tenx, "FAIL");
    assert.equal(r.hardStop, true);
    assert.equal(r.grade, "F");
    assert.equal(r.verdict, "Reject");
  });
  it("Survival < 4 → FAIL", () => {
    const v = [10, 10, 10, 10, 10, 10, 2, 10, 10, 8];
    const r = scoreAnalysis(scores(v), flags());
    assert.equal(r.hardGates.survival, "FAIL");
    assert.equal(r.grade, "F");
  });
  it("Customer < 4 → WATCHLIST, not FAIL", () => {
    const v = [10, 10, 10, 10, 10, 2, 10, 10, 10, 8];
    const r = scoreAnalysis(scores(v), flags());
    assert.equal(r.hardGates.customer, "WATCHLIST");
    assert.equal(r.hardStop, false);
    assert.equal(r.verdict, "Watchlist");
  });
});

describe("penalties no longer subtract points", () => {
  it("Management Yellow does not cut the score", () => {
    const { score } = adjustedWildcardScore(100, flags([makeFlag("MANAGEMENT", "YELLOW", "x")]));
    assert.equal(score, 100);
  });
  it("Survival Red → Hard Stop", () => {
    const r = scoreAnalysis(
      scores(Array(10).fill(10)),
      flags([makeFlag("SURVIVAL", "RED", "runway")]),
    );
    assert.equal(r.hardStop, true);
    assert.equal(r.grade, "F");
    assert.equal(r.verdict, "Reject");
  });
});

describe("score clamp", () => {
  it("never below 0", () => {
    const { score } = adjustedWildcardScore(0, flags([makeFlag("MANAGEMENT", "RED", "x")]));
    assert.equal(score, 0);
  });
});

describe("10x helpers still work", () => {
  it("target is 10x", () => {
    assert.equal(targetMarketCap(1e9), 1e10);
    assert.equal(requiredRevenueFor10x(1e9, "EV_SALES", 10, 0.1), 1e9);
  });
});

describe("evaluateHardGates N/A", () => {
  it("missing F10 is RESEARCH REQUIRED", () => {
    const s = scores(Array(10).fill(8));
    s[9]!.score = null;
    s[9]!.weightedScore = null;
    const g = evaluateHardGates(s);
    assert.equal(g.tenx, "RESEARCH REQUIRED");
    assert.equal(g.evidence, "RESEARCH REQUIRED");
  });
});
