import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CRITERIA } from "./defaults.ts";
import { parseCriteriaPack } from "./validate.ts";
import { getCriteria, resetActiveCriteria, setActiveCriteria } from "./active.ts";
import { hashCriteria, criteriaProvenance } from "./hash.ts";
import { opportunityScore } from "../oversold.ts";
import { scoreXBagger } from "../xbagger.ts";
import { buildTenxMath, defaultScenarios } from "../../tenx/calculator.ts";

const fin = {
  revenueTtm: 1e8,
  revenuePrior: 8e7,
  operatingIncomeTtm: 1e7,
  netIncomeTtm: 5e6,
  cash: 2e8,
  totalDebt: 0,
  sharesOutstanding: 1e8,
  grossMargin: 0.6,
  operatingMargin: 0.1,
  cfo: 1e7,
  fcf: 1e7,
};

describe("criteria pack", () => {
  it("parses the builtin pack", () => {
    const parsed = parseCriteriaPack(DEFAULT_CRITERIA);
    assert.equal(parsed.ok, true);
  });

  it("rejects merged-weight mistakes on X-Bagger", () => {
    const bad = structuredClone(DEFAULT_CRITERIA);
    bad.engines.xbagger.weights.F1 = 50;
    const parsed = parseCriteriaPack(bad);
    assert.equal(parsed.ok, false);
  });

  it("rejects oversold weight sum that is not 1", () => {
    const bad = structuredClone(DEFAULT_CRITERIA);
    bad.engines.oversold.weights.fundamental = 0.9;
    const parsed = parseCriteriaPack(bad);
    assert.equal(parsed.ok, false);
  });

  it("rejects inverted grade thresholds", () => {
    const bad = structuredClone(DEFAULT_CRITERIA);
    bad.engines.quality70.gradeThresholds = { S: 40, A: 50, B: 60, C: 70, D: 80 };
    const parsed = parseCriteriaPack(bad);
    assert.equal(parsed.ok, false);
  });

  it("rejects unknown quality factor bands", () => {
    const bad = structuredClone(DEFAULT_CRITERIA);
    bad.engines.quality70.bands.Q99 = [[1, 10]];
    const parsed = parseCriteriaPack(bad);
    assert.equal(parsed.ok, false);
  });

  it("round-trips JSON", () => {
    const raw = JSON.parse(JSON.stringify(DEFAULT_CRITERIA));
    const parsed = parseCriteriaPack(raw);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(hashCriteria(parsed.pack), hashCriteria(DEFAULT_CRITERIA));
  });

  it("applies overlay weights to the next X-Bagger run only", () => {
    resetActiveCriteria();
    const overlay = structuredClone(DEFAULT_CRITERIA);
    overlay.overlayId = "test-overlay";
    overlay.engines.xbagger.version = "XBG-v2.0+test";
    overlay.engines.xbagger.hardGates.tenxMin = 9;
    setActiveCriteria(overlay);
    const d = defaultScenarios(1e9, fin);
    assert.ok(d);
    const math = buildTenxMath(1e9, fin, [d.bear, d.base, d.bull]);
    const x = scoreXBagger({
      factors: [
        { code: "F1", score: 8, reason: "ok" },
        { code: "F2", score: 8, reason: "ok" },
        { code: "F3", score: 8, reason: "ok" },
        { code: "F4", score: 8, reason: "ok" },
        { code: "F5", score: 8, reason: "ok" },
        { code: "F6", score: 8, reason: "ok" },
        { code: "F7", score: 8, reason: "ok" },
        { code: "F8", score: 8, reason: "ok" },
        { code: "F9", score: 8, reason: "ok" },
        { code: "F10", score: 6, reason: "border" },
      ],
      tenxMath: math,
      tenxScenarios: [d.bear, d.base, d.bull],
      tenxFeasibility: "POSSIBLE",
    });
    assert.equal(x.version, "XBG-v2.0+test");
    assert.equal(x.grade, "F");
    assert.equal(x.gates.tenx, "FAIL");
    const prov = criteriaProvenance(overlay);
    assert.equal(prov.overlayId, "test-overlay");
    assert.equal(prov.hash, hashCriteria(overlay));
    resetActiveCriteria();
    assert.equal(getCriteria().overlayId, "builtin");
  });

  it("keeps default oversold formula", () => {
    resetActiveCriteria();
    const opp = opportunityScore(8, 7, 6, 5);
    assert.equal(Number(opp.toFixed(2)), 6.8);
  });

  it("invalid JSON keeps previous active criteria", () => {
    resetActiveCriteria();
    const overlay = structuredClone(DEFAULT_CRITERIA);
    overlay.overlayId = "keep-me";
    setActiveCriteria(overlay);
    const parsed = parseCriteriaPack({ schema: "nope" });
    assert.equal(parsed.ok, false);
    assert.equal(getCriteria().overlayId, "keep-me");
    resetActiveCriteria();
  });
});
