import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import { EXECUTE_FULL_100, FULL100_EXECUTION_DISABLED } from "./jobs.ts";
import { V24_OPERATOR_ENABLED } from "./v24-operator.ts";
import {
  FULL100_EPHEMERAL,
  FULL100_NOT_UNIVERSE,
  full100ResearchOne,
  full100Status,
} from "./full100.ts";

describe("Full 100 sequential operator", () => {
  it("is locked again after the Neon run; v2.4 queue operator stays locked", () => {
    assert.equal(EXECUTE_FULL_100, false);
    assert.equal(V24_OPERATOR_ENABLED, false);
    assert.equal(SAMPLE_RESEARCH_100.length, 100);
  });

  it("refuses tickers outside Sample100 so extra Smoke names stay untouched", async () => {
    const res = await full100ResearchOne("MSFT");
    assert.equal(res.ok, false);
    assert.equal(res.error, FULL100_NOT_UNIVERSE);
  });

  it("refuses when locked, and PGLite cannot fake a Neon run", async () => {
    const res = await full100ResearchOne("DSP");
    assert.equal(res.ok, false);
    assert.ok(
      res.error === FULL100_EXECUTION_DISABLED || res.error === FULL100_EPHEMERAL,
      res.error,
    );
  });

  it("status reports remaining universe without writing", async () => {
    const status = await full100Status();
    assert.equal(status.authorized, false);
    assert.equal(status.rows.length, 100);
    assert.equal(status.researched + status.remaining, 100);
    assert.equal(status.remainingTickers.length, status.remaining);
  });
});
