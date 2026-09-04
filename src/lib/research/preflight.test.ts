import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import { runLivePreflight } from "./preflight.ts";
import { EXECUTE_FULL_100 } from "./jobs.ts";
import { LAST_VERIFIED_BUILD } from "./verified-build.ts";

describe("real preflight", () => {
  it("does not hardcode live PASS values", async () => {
    const result = await runLivePreflight({
      companies: [],
      snapshots: [],
      sql: null,
      executeFull100: false,
    });
    const live = result.checks.filter((c) => c.kind === "LIVE");
    const verified = result.checks.filter((c) => c.kind === "LAST_VERIFIED");
    assert.ok(live.length >= 8);
    assert.ok(verified.length >= 4);
    assert.equal(result.dbAvailable, false);
    assert.equal(result.ready, false);
    assert.equal(result.p0TestsKind, "LAST_VERIFIED");
    assert.equal(result.dbAvailableKind, "LIVE");
    assert.equal(EXECUTE_FULL_100, false);
    assert.ok(verified.every((c) => c.detail.includes(LAST_VERIFIED_BUILD.commitSha.slice(0, 7))));
  });

  it("DB unavailable → dbAvailable false, ready false", async () => {
    const result = await runLivePreflight({
      companies: SAMPLE_RESEARCH_100,
      snapshots: [],
      sql: null,
      universeMembers: SAMPLE_RESEARCH_100,
      executeFull100: true,
    });
    assert.equal(result.dbAvailable, false);
    assert.equal(result.ready, false);
    assert.equal(result.checks.find((c) => c.id === "db")?.pass, false);
  });

  it("universe count 99 → universe100 false, ready false", async () => {
    const result = await runLivePreflight({
      companies: [],
      snapshots: [],
      sql: null,
      universeMembers: SAMPLE_RESEARCH_100.slice(0, 99),
      executeFull100: true,
    });
    assert.equal(result.universe100, false);
    assert.equal(result.ready, false);
  });

  it("flag off blocks ready even if other snapshot checks pass", async () => {
    const result = await runLivePreflight({
      companies: SAMPLE_RESEARCH_100,
      snapshots: [],
      sql: null,
      executeFull100: false,
    });
    assert.equal(result.executeFull100, false);
    assert.equal(result.ready, false);
    assert.equal(result.executorReady, true);
  });
});
