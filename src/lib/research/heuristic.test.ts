import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heuristicDraft } from "./heuristic.ts";
import { emptyFinancials } from "./quote-parse.ts";
import { extractNamedCustomers } from "./pack.ts";
import type { ResearchQuote } from "../types.ts";
import type { ResearchPack as Pack } from "./pack.ts";

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

const ionqPack: Pack = {
  profile:
    "IonQ is the world's leading quantum platform. customers and partners including Amazon Web Services, AstraZeneca, and NVIDIA achieve a 20x performance. In 2025, the company achieved 99.99% two-qubit gate fidelity, setting a world record in quantum computing performance.",
  website: "https://ionq.com",
  wiki: "American quantum computing company.",
  customers: ["Amazon Web Services", "AstraZeneca", "NVIDIA"],
  techClaims: [
    "In 2025, the company achieved 99.99% two-qubit gate fidelity, setting a world record in quantum computing performance.",
  ],
  news: [
    {
      title: "IonQ’s Investor Day Is Approaching",
      date: "2026-09-02",
      url: "https://example.com",
    },
  ],
};

describe("extractNamedCustomers", () => {
  it("keeps proper names and drops use-case nouns", () => {
    const names = extractNamedCustomers(ionqPack.profile);
    assert.ok(names.includes("Amazon Web Services"));
    assert.ok(names.includes("AstraZeneca"));
    assert.ok(names.includes("NVIDIA"));
    assert.ok(!names.includes("materials science"));
  });
});

describe("heuristicDraft IONQ-like filings", () => {
  it("scores all 10 factors from filings + profile", () => {
    const d = heuristicDraft(ionqQuote(), ionqPack);
    const by = Object.fromEntries(d.factors.map((f) => [f.code, f]));
    assert.equal(d.factors.length, 10);
    assert.equal(by.F2?.score, 2);
    assert.equal(by.F4?.score, 2);
    assert.equal(by.F6?.score, 1);
    assert.equal(by.F7?.score, 1);
    assert.equal(by.F8?.score, 0);
    assert.equal(by.F10?.score, 0);
    assert.match(by.F6?.summary ?? "", /NVIDIA|AstraZeneca|Amazon/);
    assert.ok(by.F2?.found);
    assert.ok(by.F2?.benchmark);
  });
});
