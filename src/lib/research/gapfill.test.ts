import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import { persistIsDurable } from "../persist/durable.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import {
  GAPFILL_EPHEMERAL,
  GAPFILL_NOT_UNIVERSE,
  gapfillResearchOne,
  snapshotNeedsGapFill,
} from "./gapfill.ts";

function snap(partial: Partial<Snapshot>): Snapshot {
  return {
    id: "s1",
    companyId: "c1",
    asOf: "2026-09-15",
    createdAt: "2026-09-15T00:00:00.000Z",
    price: 1,
    marketCap: 1,
    enterpriseValue: 1,
    currency: "USD",
    financials: {
      revenueTtm: 1,
      revenuePrior: null,
      operatingIncomeTtm: null,
      netIncomeTtm: null,
      cash: null,
      totalDebt: null,
      sharesOutstanding: null,
      grossMargin: null,
      operatingMargin: null,
      cfo: null,
      fcf: null,
    },
    derived: { series: null } as Snapshot["derived"],
    evidence: [],
    xbagger: { coverage: 0.4 } as Snapshot["xbagger"],
    oversold: { coverage: 0.4 } as Snapshot["oversold"],
    quality: { coverage: 0.27 } as Snapshot["quality"],
    lenses: [],
    tags: ["RESEARCH REQUIRED"],
    researchPriority: null,
    researchPriorityParts: null,
    oneSentenceThesis: "",
    catalysts: [],
    risks: [],
    nextProof: [],
    killCriteria: [],
    findings: [],
    overallCoverage: 0.3,
    overallConfidence: "Low",
    researchProvider: "test",
    tenxMath: null,
    tenxScenarios: [],
    ...partial,
  };
}

describe("gap fill remaining", () => {
  it("does not keep a name remaining just because overall status is RESEARCH_REQUIRED", () => {
    const filled = snap({
      derived: {
        series: {
          points: [
            { period: "2023-12-31", periodType: "FY", revenue: 1 },
            { period: "2024-12-31", periodType: "FY", revenue: 2 },
            { period: "2025-12-31", periodType: "FY", revenue: 3 },
          ],
          provenance: [{ period: "2025-12-31", sourceTier: "TIER_2", sourceName: "Yahoo" }],
        },
      } as Snapshot["derived"],
    });
    assert.equal(snapshotNeedsGapFill(filled), false);
  });

  it("drops remaining after Yahoo timeseries was attempted even if FY is short", () => {
    const attempted = snap({
      sourceAttempts: [{ provider: "yahoo-timeseries", requestedAt: "2026-09-15T00:00:00.000Z", status: "empty" }],
    });
    assert.equal(snapshotNeedsGapFill(attempted), false);
  });

  it("still needs fill when there is no series and no timeseries attempt", () => {
    assert.equal(snapshotNeedsGapFill(snap({})), true);
    assert.equal(snapshotNeedsGapFill(undefined), true);
  });
});

describe("gap fill from internet series", () => {
  it("refuses tickers outside Sample100", async () => {
    const res = await gapfillResearchOne("MSFT");
    assert.equal(res.ok, false);
    assert.equal(res.error, GAPFILL_NOT_UNIVERSE);
  });

  it("refuses PGLite so preview cannot overwrite Neon", async () => {
    if (persistIsDurable()) return;
    const res = await gapfillResearchOne(SAMPLE_RESEARCH_100[0]!.ticker);
    assert.equal(res.ok, false);
    assert.equal(res.error, GAPFILL_EPHEMERAL);
  });
});
