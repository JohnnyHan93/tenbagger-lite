import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatScreenFlags, xbaggerScreen } from "./xbagger-screen.ts";
import type { XGates } from "./xbagger.ts";
import type { DerivedMetrics } from "../metrics/derived.ts";

function gates(customer: XGates["customer"] = "PASS"): XGates {
  return { trust: "PASS", survival: "PASS", tenx: "PASS", customer };
}

function d(extra: Partial<DerivedMetrics> = {}): Pick<
  DerivedMetrics,
  "cash" | "fcf" | "opTtm" | "shareGrowth" | "backlogGrowth" | "runwayYears" | "industryGroup"
> {
  return {
    cash: 40,
    fcf: 12,
    opTtm: 20,
    shareGrowth: 0.01,
    backlogGrowth: null,
    runwayYears: null,
    industryGroup: "saas",
    ...extra,
  };
}

describe("XBG-SCR-v1.0", () => {
  it("does not flag a self-funded named-customer name", () => {
    const flags = xbaggerScreen({ xbagger: { gates: gates("PASS") }, derived: d() });
    assert.equal(formatScreenFlags(flags), "—");
    assert.ok(!flags.some((f) => f.level === "FAIL"));
  });

  it("flags short runway and burn without changing X scores", () => {
    const flags = xbaggerScreen({
      xbagger: { gates: gates("PASS") },
      derived: d({ fcf: -20, cash: 10, opTtm: -5, runwayYears: 0.5 }),
    });
    assert.ok(flags.some((f) => f.kind === "RUNWAY" && f.level === "FAIL"));
    assert.ok(flags.some((f) => f.kind === "BURN"));
  });

  it("treats missing named customers as PoC watch, not a score", () => {
    const flags = xbaggerScreen({
      xbagger: { gates: gates("WATCHLIST") },
      derived: d(),
    });
    const poc = flags.find((f) => f.kind === "POC");
    assert.equal(poc?.level, "WATCH");
  });

  it("does not invent backlog conversion for semis", () => {
    const flags = xbaggerScreen({
      xbagger: { gates: gates("PASS") },
      derived: d({ industryGroup: "semi", backlogGrowth: null }),
    });
    assert.ok(flags.some((f) => f.kind === "BACKLOG" && f.level === "NA"));
  });
});
