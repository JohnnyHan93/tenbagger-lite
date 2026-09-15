import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyFinancials } from "./quote-parse.ts";
import { applyQuoteOverrides, missingQuoteFields, parseUserMoney, quoteIsUsable } from "./manual-quote.ts";
import type { ResearchQuote } from "../types.ts";

function partial(): ResearchQuote {
  return {
    ticker: "XYZ",
    exchange: "NYSE",
    companyName: "XYZ Corp",
    currency: "USD",
    price: 12.5,
    marketCap: 0,
    enterpriseValue: 0,
    country: "US",
    sector: "",
    industry: "",
    financials: emptyFinancials(),
  };
}

describe("parseUserMoney", () => {
  it("reads Korean units, Yahoo abbreviations, and plain numbers", () => {
    assert.equal(parseUserMoney("47.5조"), 47.5e12);
    assert.equal(parseUserMoney("1.2억"), 1.2e8);
    assert.equal(parseUserMoney("14.4B"), 14.4e9);
    assert.equal(parseUserMoney("37.64"), 37.64);
    assert.equal(parseUserMoney("14,439,987,701"), 14439987701);
    assert.equal(parseUserMoney(""), null);
  });
});

describe("applyQuoteOverrides", () => {
  it("fills missing market cap so analysis can run", () => {
    const q = applyQuoteOverrides(partial(), { marketCap: 1.2e9, financials: { revenueTtm: 80e6 } }, "XYZ");
    assert.ok(q);
    assert.equal(quoteIsUsable(q), true);
    assert.equal(q.marketCap, 1.2e9);
    assert.equal(q.financials.revenueTtm, 80e6);
    assert.equal(q.price, 12.5);
    assert.deepEqual(missingQuoteFields(q), []);
  });

  it("builds a quote from overrides when fetch returned nothing", () => {
    const q = applyQuoteOverrides(null, { price: 70000, marketCap: 400e12, companyName: "삼성전자" }, "005930");
    assert.ok(q);
    assert.equal(q.currency, "KRW");
    assert.equal(q.country, "KR");
    assert.equal(q.companyName, "삼성전자");
    assert.equal(quoteIsUsable(q), true);
  });
});
