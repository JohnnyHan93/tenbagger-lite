import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heuristicDraft } from "./heuristic.ts";
import { emptyFinancials } from "./quote-parse.ts";
import type { ResearchQuote } from "../types.ts";

function ionqQuote(): ResearchQuote {
  return {
    ticker: "IONQ",
    exchange: "NYSE",
    companyName: "IonQ, Inc.",
    currency: "USD",
    price: 38,
    marketCap: 14_440_000_000,
    enterpriseValue: 14_440_000_000,
    country: "US",
    sector: "Technology",
    industry: "Computer Hardware",
    financials: {
      ...emptyFinancials(),
      revenueTtm: 130_016_000,
      revenuePrior: 43_073_000,
      operatingIncomeTtm: -633_715_000,
      netIncomeTtm: -510_378_000,
      cash: 2_392_156_000,
      totalDebt: 0,
      grossMargin: 0.4,
      operatingMargin: -4.87,
      fcf: -283_187_000,
    },
  };
}

describe("heuristicDraft IONQ-like filings", () => {
  it("gives F2=2 from accelerating revenue, not a blanket 1-cap", () => {
    const d = heuristicDraft(ionqQuote());
    const by = Object.fromEntries(d.factors.map((f) => [f.code, f]));
    assert.equal(by.F2?.score, 2);
    assert.match(by.F2?.summary ?? "", /202|%|성장/);
    assert.equal(by.F8?.score, 0);
    assert.equal(by.F7?.score, 1);
    assert.ok(!d.factors.every((f) => f.summary.includes("자동 수집만으로는 2점")));
    assert.ok(d.evidences.some((e) => e.factorCode === "F2" && e.evidenceType === "FACT"));
  });

  it("keeps story factors at 1 with an unlock condition", () => {
    const d = heuristicDraft(ionqQuote());
    const f6 = d.factors.find((f) => f.code === "F6");
    assert.equal(f6?.score, 1);
    assert.match(f6?.summary ?? "", /2점 조건/);
  });
});
