import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeFlag } from "../risk/flags.ts";
import type { ResearchDraft } from "../types.ts";
import { materializeAnalysis } from "./pipeline.ts";
import { FACTOR_ORDER } from "./config.ts";


function dummyDraft(over: Partial<ResearchDraft> = {}): ResearchDraft {
  const base: ResearchDraft = {
    quote: {
      ticker: "DUMMY",
      exchange: "NASDAQ",
      companyName: "Dummy Co",
      currency: "USD",
      price: 10,
      marketCap: 1_000_000_000,
      enterpriseValue: 1_000_000_000,
      country: "US",
      sector: "Tech",
      industry: "Software",
      financials: {
        revenueTtm: 80_000_000,
        operatingIncomeTtm: 8_000_000,
        netIncomeTtm: 5_000_000,
        cash: 120_000_000,
        totalDebt: 10_000_000,
        sharesOutstanding: 100_000_000,
        grossMargin: 0.7,
        operatingMargin: 0.1,
        fcf: 4_000_000,
      },
    },
    factors: FACTOR_ORDER.map((code) => ({
      code,
      score: 2,
      summary: "test",
    })),
    redFlags: [
      makeFlag("MANAGEMENT", "GREEN", "ok"),
      makeFlag("SURVIVAL", "GREEN", "ok"),
      makeFlag("TENX", "GREEN", "ok"),
    ],
    tenxScenarios: [],
    requiredRevenue: null,
    requiredNetIncome: null,
    requiredPe: null,
    requiredEvSales: null,
    tenxFeasibility: "HIGH",
    catalysts: ["c1"],
    risks: ["r1"],
    nextProof: ["p1"],
    killCriteria: ["k1"],
    thesis: "Dummy Co는 성장 시장에서 해자를 기반으로 고객을 확대하며 현재 약 $1.00B에서 매출 $1.25B를 달성하면 약 10배가 가능하다.",
    evidences: [],
    researchProvider: "test",
  };
  return { ...base, ...over };
}

describe("analysis pipeline", () => {
  it("persists a full analysis with 100 raw and grade A", () => {
    const a = materializeAnalysis("c1", dummyDraft());
    assert.equal(a.factorTotal, 20);
    assert.equal(a.rawScore, 100);
    assert.equal(a.adjustedScore, 100);
    assert.equal(a.grade, "A");
    assert.equal(a.verdict, "DEEP DIVE NOW");
    assert.equal(a.hardStop, false);
    assert.equal(a.tenxScenarios.length, 2);
    assert.ok(a.oneSentenceThesis.length > 10);
    assert.equal(a.scoringVersion, "TenbaggerLite-v1.0");
  });

  it("does not mutate previous analyses — new id each time", () => {
    const a1 = materializeAnalysis("c1", dummyDraft());
    const a2 = materializeAnalysis("c1", dummyDraft());
    assert.notEqual(a1.id, a2.id);
  });
});
