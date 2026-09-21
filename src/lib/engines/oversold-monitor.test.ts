import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capitalReturnOf,
  formatMeg,
  marketExpectationGap,
  oversoldAlerts,
  pricePathOf,
  sectorOverlayOf,
} from "./oversold-monitor.ts";
import type { OversoldResult } from "./oversold.ts";
import type { Snapshot } from "../domain/snapshot.ts";

function o(extra: Partial<OversoldResult> = {}): OversoldResult {
  return {
    version: "OSM-v2.3",
    fundamental: 7,
    valuation: 6,
    oversold: 7,
    riskInverse: 6,
    opportunity: 6.5,
    valueTrap: 2,
    case: "A",
    caseStatus: "COMPLETE",
    peakEarnings: false,
    peakEarningsLevel: "NONE",
    coverage: 1,
    availableWeight: 1,
    confidence: "High",
    reasons: { fundamental: "", valuation: "", oversold: "", risk: "", trap: "" },
    status: "COMPLETE",
    ...extra,
  };
}

function snap(over: OversoldResult, extra: Partial<Snapshot> = {}): Snapshot {
  return {
    id: "s1",
    companyId: "c1",
    asOf: "2026-09-21",
    createdAt: "2026-09-21T00:00:00.000Z",
    price: 100,
    marketCap: 1e9,
    enterpriseValue: 1e9,
    currency: "USD",
    financials: {} as Snapshot["financials"],
    derived: {} as Snapshot["derived"],
    evidence: [],
    xbagger: {} as Snapshot["xbagger"],
    oversold: over,
    quality: {} as Snapshot["quality"],
    lenses: [],
    tags: [],
    researchPriority: null,
    researchPriorityParts: null,
    oneSentenceThesis: "",
    catalysts: [],
    risks: [],
    nextProof: [],
    killCriteria: [],
    findings: [],
    overallCoverage: 1,
    overallConfidence: "High",
    researchProvider: "test",
    tenxMath: null,
    tenxScenarios: [],
    ...extra,
  };
}

describe("OSM-MON-v1.0 MEG", () => {
  it("is N/A without F or O", () => {
    assert.equal(marketExpectationGap(o({ fundamental: null })).meg, null);
    assert.equal(marketExpectationGap(o({ oversold: null })).meg, null);
  });

  it("does not invent +2 from a value trap", () => {
    const r = marketExpectationGap(o({ fundamental: 3, oversold: 8, valueTrap: 8 }));
    assert.equal(r.meg, -2);
  });

  it("good oversold is +1 or +2, never mixed into Opp", () => {
    const r = marketExpectationGap(o({ fundamental: 7, oversold: 7, valueTrap: 1 }));
    assert.equal(r.meg, 2);
    assert.equal(formatMeg(r.meg), "+2");
  });
});

describe("price path", () => {
  it("classifies A/B/C/D without touching engine case", () => {
    assert.equal(pricePathOf(o({ fundamental: 8, oversold: 7 })).path, "GOOD_OVERSOLD");
    assert.equal(pricePathOf(o({ fundamental: 3, oversold: 8 })).path, "TRAP_RISK");
    assert.equal(pricePathOf(o({ fundamental: 8, oversold: 1 })).path, "RERATING");
    assert.equal(pricePathOf(o({ fundamental: 3, oversold: 1 })).path, "PRICE_RALLY");
    assert.equal(pricePathOf(o({ fundamental: null, oversold: 7 })).path, null);
  });
});

describe("alert gates", () => {
  it("fires Opp ±0.20, VT ±1, rank ±2, enter/exit", () => {
    const prev = snap(o({ opportunity: 6.0, valueTrap: 2 }), { price: 100 });
    const curr = snap(o({ opportunity: 6.4, valueTrap: 4 }), { price: 108 });
    const a = oversoldAlerts({ prev, curr, prevRank: 5, currRank: 2 });
    assert.ok(a.some((x) => x.kind === "OPP"));
    assert.ok(a.some((x) => x.kind === "VT"));
    assert.ok(a.some((x) => x.kind === "PRICE"));
    assert.ok(a.some((x) => x.kind === "RANK"));
  });

  it("does not alert on noise below gates", () => {
    const prev = snap(o({ opportunity: 6.5, valueTrap: 2 }), { price: 100 });
    const curr = snap(o({ opportunity: 6.55, valueTrap: 2 }), { price: 102 });
    const a = oversoldAlerts({ prev, curr, prevRank: 3, currRank: 4 });
    assert.equal(a.length, 0);
  });

  it("never claims MEG is part of Opp", () => {
    const r = marketExpectationGap(o());
    assert.notEqual(r.meg, o().opportunity);
  });

  it("fires 52W drawdown ±10pp", () => {
    const prev = snap(o(), { price: 100, derived: { drawdown52w: 0.12 } as Snapshot["derived"] });
    const curr = snap(o(), { price: 100, derived: { drawdown52w: 0.28 } as Snapshot["derived"] });
    const a = oversoldAlerts({ prev, curr, prevRank: 3, currRank: 3 });
    assert.ok(a.some((x) => x.kind === "DRAWDOWN"));
  });
});

describe("capital return overlay", () => {
  it("never treats share-count drop as buyback+cancel", () => {
    const r = capitalReturnOf(-0.04);
    assert.equal(r.code, "LIMITED_POS");
    assert.equal(capitalReturnOf(null).code, "NA");
    assert.equal(capitalReturnOf(0.2).code, "NEGATIVE");
  });
});

describe("sector overlay", () => {
  it("lists checks without scoring them", () => {
    assert.equal(sectorOverlayOf("saas").id, "AI_SOFTWARE");
    assert.equal(sectorOverlayOf("semi").id, "SEMI_HBM");
    assert.equal(sectorOverlayOf("financial").id, "BROKERAGE");
    assert.equal(sectorOverlayOf("other").id, "NONE");
  });
});
