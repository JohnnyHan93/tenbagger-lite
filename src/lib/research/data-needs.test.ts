import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyFinancials } from "./quote-parse.ts";
import { listDataNeeds } from "./data-needs.ts";
import { applyManualFill, parsePctInput } from "./manual-fill.ts";
import { runSnapshot } from "../engines/run.ts";
import type { Company } from "../types.ts";

const company: Company = {
  id: "c1",
  ticker: "DEMOX",
  exchange: "NASDAQ",
  companyName: "Demo X",
  country: "US",
  sector: "Technology",
  industry: "Software",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function quote(extra: Partial<Parameters<typeof runSnapshot>[0]["quote"]> = {}) {
  return {
    ticker: "DEMOX",
    exchange: "NASDAQ",
    companyName: "Demo X",
    currency: "USD" as const,
    price: 12,
    marketCap: 1_200_000_000,
    enterpriseValue: 1_200_000_000,
    country: "US",
    sector: "Technology",
    industry: "Software",
    financials: emptyFinancials(),
    ...extra,
  };
}

describe("parsePctInput", () => {
  it("accepts 18, 18%, and 0.18", () => {
    assert.equal(parsePctInput("18"), 0.18);
    assert.equal(parsePctInput("18%"), 0.18);
    assert.equal(parsePctInput("0.18"), 0.18);
  });
});

describe("listDataNeeds", () => {
  it("splits AUTO scrape vs MANUAL disclosure per engine", () => {
    const snap = runSnapshot({ company, quote: quote() });
    const r = listDataNeeds(snap, company);
    assert.ok(r.counts.x > 0);
    assert.ok(r.items.some((i) => i.engine === "xbagger" && i.factor === "X01" && i.mode === "MANUAL"));
    assert.ok(r.fields.some((f) => f.key === "tamCagr"));
    assert.ok(r.fields.some((f) => f.key === "customers"));
    assert.ok(r.fields.some((f) => f.mode === "AUTO"));
  });
});

describe("applyManualFill", () => {
  it("scores F1/F6 from TAM CAGR and named customers without inventing the rest", () => {
    const snap = runSnapshot({
      company,
      quote: quote({
        financials: {
          ...emptyFinancials(),
          revenueTtm: 80_000_000,
          revenuePrior: 50_000_000,
          cash: 40_000_000,
          totalDebt: 0,
          fcf: 5_000_000,
          grossMargin: 0.55,
          operatingIncomeTtm: 4_000_000,
        },
      }),
    });
    assert.equal(snap.xbagger.factors.find((f) => f.code === "F1")?.score, null);
    assert.equal(snap.xbagger.factors.find((f) => f.code === "F6")?.score, null);

    const next = applyManualFill(snap, company, {
      pack: { tamCagr: 0.22, customers: ["NVIDIA", "AWS"] },
      extras: { organicShare: 0.95 },
      high52w: 20,
    });
    assert.notEqual(next.xbagger.factors.find((f) => f.code === "F1")?.score, null);
    assert.equal(next.xbagger.factors.find((f) => f.code === "F6")?.score, 4);
    assert.notEqual(next.quality.factors.find((f) => f.id === "Q08")?.score, null);
    assert.notEqual(next.oversold.oversold, null);
    assert.notEqual(next.id, snap.id);
  });

  it("merges 3Y CFO series so Q22 persistence can score", () => {
    const snap = runSnapshot({
      company,
      quote: quote({
        financials: { ...emptyFinancials(), revenueTtm: 100, cfo: 10, fcf: 8, netIncomeTtm: 9 },
      }),
    });
    assert.equal(snap.quality.factors.find((f) => f.id === "Q22")?.score, null);
    const next = applyManualFill(snap, company, {
      series: { fyCfo: [6, 8, 11], fyRevenue: [70, 85, 100] },
    });
    assert.equal(next.quality.factors.find((f) => f.id === "Q22")?.score, 10);
    assert.ok((next.derived.series?.points.length ?? 0) >= 3);
  });
});
