import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { V24_OPERATOR_ENABLED } from "./v24-operator.ts";
import { persistIsDurable } from "../persist/durable.ts";
import {
  SMOKE_12,
  SMOKE_12_TICKERS,
  SMOKE12_EPHEMERAL,
  SMOKE12_UNKNOWN_TICKER,
  smoke12Membership,
  smoke12ResearchOne,
} from "./smoke12.ts";

describe("Smoke 12 gate", () => {
  it("is 12 names: 3 Sample100 + 9 extra", () => {
    assert.equal(SMOKE_12.length, 12);
    assert.equal(SMOKE_12_TICKERS.length, 12);
    const { universe, extra } = smoke12Membership();
    assert.deepEqual(
      universe.slice().sort(),
      ["005930.KS", "105560.KS", "INOD"].sort(),
    );
    assert.equal(extra.length, 9);
    assert.ok(extra.includes("MSFT"));
    assert.ok(extra.includes("196170.KQ"));
  });

  it("does not unlock the v2.4 queue operator", () => {
    assert.equal(V24_OPERATOR_ENABLED, false);
  });

  it("refuses unknown tickers", async () => {
    const res = await smoke12ResearchOne("AAPL");
    assert.equal(res.ok, false);
    assert.equal(res.error, SMOKE12_UNKNOWN_TICKER);
  });

  it("refuses PGLite so preview cannot fake a Neon run", async () => {
    if (persistIsDurable()) return;
    const res = await smoke12ResearchOne("MSFT");
    assert.equal(res.ok, false);
    assert.equal(res.error, SMOKE12_EPHEMERAL);
  });
});
