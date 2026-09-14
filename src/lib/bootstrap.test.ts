import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanTickers, cleanWorkspace, isUsableCompany, mergeWorkspaces } from "./bootstrap.ts";
import { EMPTY_SETTINGS } from "./bootstrap.ts";

describe("workspace sanitizer", () => {
  it("drops companies without ticker so dashboard cannot read undefined.ticker", () => {
    assert.equal(isUsableCompany(undefined), false);
    assert.equal(isUsableCompany({ id: "c1" }), false);
    const cleaned = cleanWorkspace({
      companies: [undefined, { id: "c1" }, { id: "c2", ticker: "INOD", companyName: "Innodata" }] as never,
      snapshots: [undefined, { id: "s1", companyId: "c2" }] as never,
      universes: [{ id: "u1", tickers: [undefined, "MSFT", { ticker: "NVDA" }] }] as never,
      watchlist: ["c2", "missing"],
      audit: [],
      settings: EMPTY_SETTINGS,
    });
    assert.equal(cleaned.companies.length, 1);
    assert.equal(cleaned.companies[0]!.ticker, "INOD");
    assert.equal(cleaned.snapshots.length, 0);
    assert.deepEqual(
      cleaned.universes[0]!.tickers.map((t) => t.ticker),
      ["MSFT", "NVDA"],
    );
  });

  it("mergeWorkspaces skips holes in company and ticker lists", () => {
    const merged = mergeWorkspaces(
      {
        companies: [undefined as never, { id: "c1", ticker: "INOD", companyName: "A", country: "US", exchange: "NASDAQ", sector: "", industry: "", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
        snapshots: [],
        universes: [{ id: "u1", name: "x", version: 1, market: "GLOBAL", status: "open", createdAt: "", lockedAt: null, tickers: [undefined as never, { ticker: "INOD" }] }],
        watchlist: [],
        audit: [],
        settings: EMPTY_SETTINGS,
      },
      {
        companies: [],
        snapshots: [],
        universes: [],
        watchlist: [],
        audit: [],
        settings: EMPTY_SETTINGS,
      },
    );
    assert.equal(merged.companies[0]!.ticker, "INOD");
    assert.equal(merged.universes[0]!.tickers[0]!.ticker, "INOD");
  });
});

describe("cleanTickers", () => {
  it("accepts string rows and objects", () => {
    assert.deepEqual(cleanTickers(["inod", { ticker: "NVDA" }, null, ""]), [
      { ticker: "inod", name: undefined },
      { ticker: "NVDA", name: undefined },
    ]);
  });
});
