import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FactorScore, RedFlag } from "../types.ts";
import type { FactorCode } from "./config.ts";
import { GRADE_THRESHOLDS } from "./config.ts";
import {
  adjustedWildcardScore,
  factorTotal,
  gradeFromScore,
  rawWildcardScore,
  scoreAnalysis,
} from "./wildcard-score.ts";
import { makeFlag } from "../risk/flags.ts";
import { targetMarketCap, requiredRevenueFor10x } from "../tenx/calculator.ts";


function scores(values: number[]): FactorScore[] {
  return values.map((score, i) => ({
    factorCode: `F${i + 1}` as FactorCode,
    score,
    evidenceSummary: "",
    originalScore: score,
    overrideScore: null,
    overrideReason: null,
    overrideDate: null,
  }));
}

function flags(list: RedFlag[] = []): RedFlag[] {
  return list;
}

describe("raw wildcard score", () => {
  it("20/20 → raw 100", () => {
    assert.equal(rawWildcardScore(factorTotal(scores(Array(10).fill(2)))), 100);
  });
  it("18/20 → raw 90", () => {
    const v = [2, 2, 2, 2, 2, 2, 2, 2, 2, 0];
    assert.equal(factorTotal(scores(v)), 18);
    assert.equal(rawWildcardScore(18), 90);
  });
});

describe("penalties", () => {
  it("Management Yellow → -5", () => {
    const { score } = adjustedWildcardScore(100, flags([makeFlag("MANAGEMENT", "YELLOW", "x")]));
    assert.equal(score, 95);
  });
  it("Survival Yellow → -10", () => {
    const { score } = adjustedWildcardScore(100, flags([makeFlag("SURVIVAL", "YELLOW", "x")]));
    assert.equal(score, 90);
  });
  it("Survival Red → Hard Stop", () => {
    const r = scoreAnalysis(
      scores(Array(10).fill(2)),
      flags([makeFlag("SURVIVAL", "RED", "runway")]),
    );
    assert.equal(r.hardStop, true);
    assert.equal(r.grade, "D");
    assert.equal(r.verdict, "PASS");
  });
  it("10x Red → Hard Stop", () => {
    const r = scoreAnalysis(
      scores(Array(10).fill(2)),
      flags([makeFlag("TENX", "RED", "unrealistic")]),
    );
    assert.equal(r.hardStop, true);
    assert.equal(r.grade, "D");
  });
});

describe("score clamp", () => {
  it("never below 0", () => {
    const { score } = adjustedWildcardScore(0, flags([makeFlag("MANAGEMENT", "RED", "x")]));
    assert.equal(score, 0);
  });
  it("never above 100", () => {
    assert.equal(rawWildcardScore(40), 100);
  });
});

describe("grade boundary", () => {
  it("85 → A", () => assert.equal(gradeFromScore(85, false), "A"));
  it("84 → B", () => assert.equal(gradeFromScore(84, false), "B"));
  it("70 → B", () => assert.equal(gradeFromScore(70, false), "B"));
  it("69 → C", () => assert.equal(gradeFromScore(69, false), "C"));
  it("55 → C", () => assert.equal(gradeFromScore(55, false), "C"));
  it("54 → D", () => assert.equal(gradeFromScore(54, false), "D"));
  it("hard stop overrides A", () => assert.equal(gradeFromScore(100, true), "D"));
  it("thresholds match config", () => {
    assert.equal(GRADE_THRESHOLDS.A, 85);
    assert.equal(GRADE_THRESHOLDS.B, 70);
    assert.equal(GRADE_THRESHOLDS.C, 55);
  });
});

describe("10x math", () => {
  it("target is 10× current", () => {
    assert.equal(targetMarketCap(4_000_000_000), 40_000_000_000);
  });
  it("required revenue at 10× EV/S", () => {
    const req = requiredRevenueFor10x(1_000_000_000, "EV_SALES", 10, 0.1);
    assert.equal(req, 1_000_000_000);
  });
});
