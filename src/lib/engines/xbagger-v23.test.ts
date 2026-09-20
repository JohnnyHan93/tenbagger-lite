import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinancialSnapshot } from "../types.ts";
import { buildTenxMath, defaultScenarios } from "../tenx/calculator.ts";
import { scoreXBagger } from "./xbagger.ts";
import { DEFAULT_CRITERIA } from "./criteria/defaults.ts";
import { resetActiveCriteria } from "./criteria/active.ts";
import { strategyTags } from "./matrix.ts";
import type { FactorCode } from "../scoring/config.ts";
import type { OversoldResult } from "./oversold.ts";
import type { QualityResult } from "./quality.ts";
import type { XBaggerResult } from "./xbagger.ts";

function fin(extra: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
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
    cfo: null,
    fcf: null,
    ...extra,
  };
}

const codes: FactorCode[] = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"];

function allFactors(score: number) {
  return codes.map((code) => ({ code, score, reason: "t" }));
}

describe("XBG-v2.3 F10 growth", () => {
  it("default criteria version is XBG-v2.3", () => {
    assert.equal(DEFAULT_CRITERIA.engines.xbagger.version, "XBG-v2.3");
  });

  it("no revenue → no synthetic scenarios", () => {
    assert.equal(defaultScenarios(1e9, fin()), null);
  });

  it("trust without evidence is RESEARCH REQUIRED, going concern is FAIL", () => {
    resetActiveCriteria();
    const base = {
      factors: allFactors(8),
      tenxMath: null,
      tenxScenarios: [],
      tenxFeasibility: "UNREALISTIC" as const,
    };
    assert.equal(scoreXBagger(base).gates.trust, "RESEARCH REQUIRED");
    assert.equal(scoreXBagger({ ...base, trustSignals: { management: true } }).gates.trust, "PASS");
    assert.equal(scoreXBagger({ ...base, trustSignals: { auditGoingConcern: true } }).gates.trust, "FAIL");
    assert.equal(scoreXBagger({ ...base, trustFail: true }).gates.trust, "FAIL");
  });

  it("TTM revenue without prior growth → F10 N/A", () => {
    resetActiveCriteria();
    const financials = fin({ revenueTtm: 1e8 });
    const math = buildTenxMath(1e9, financials, []);
    assert.equal(math.assumedCagr, null);
    const scenes = defaultScenarios(1e9, financials);
    const r = scoreXBagger({
      factors: allFactors(8),
      tenxMath: math,
      tenxScenarios: scenes ? [scenes.bear, scenes.base, scenes.bull] : [],
      tenxFeasibility: "HIGH",
    });
    assert.equal(r.factors.find((f) => f.code === "F10")?.score, null);
    assert.equal(r.f10MathComplete, false);
    assert.equal(r.gates.tenx, "RESEARCH REQUIRED");
  });
});

describe("strategy tags", () => {
  it("does not tag TURNAROUND when Case is incomplete", () => {
    const x = { adjustedScore: 40, grade: "C", status: "PARTIAL", coverage: 0.8, tenxFeasibility: "LOW" } as XBaggerResult;
    const o = {
      opportunity: 7,
      valueTrap: 2,
      case: "C",
      caseStatus: "INCOMPLETE",
      status: "PARTIAL",
      coverage: 0.8,
    } as OversoldResult;
    const q = { score: 50, status: "PARTIAL", coverage: 0.4 } as QualityResult;
    const tags = strategyTags(x, o, q);
    assert.equal(tags.includes("TURNAROUND"), false);
  });
});
