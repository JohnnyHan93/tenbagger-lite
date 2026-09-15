import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { financialsFromSeries, parseYahooTimeseries } from "./yahoo-series.ts";

const MSFT_FIXTURE = {
  timeseries: {
    result: [
      {
        meta: { type: ["annualTotalRevenue"] },
        annualTotalRevenue: [
          { asOfDate: "2023-06-30", reportedValue: { raw: 211915000000 } },
          { asOfDate: "2024-06-30", reportedValue: { raw: 245122000000 } },
          { asOfDate: "2025-06-30", reportedValue: { raw: 281724000000 } },
          { asOfDate: "2026-06-30", reportedValue: { raw: 331839000000 } },
        ],
      },
      {
        meta: { type: ["annualFreeCashFlow"] },
        annualFreeCashFlow: [
          { asOfDate: "2023-06-30", reportedValue: { raw: 59475000000 } },
          { asOfDate: "2024-06-30", reportedValue: { raw: 74071000000 } },
          { asOfDate: "2025-06-30", reportedValue: { raw: 71611000000 } },
          { asOfDate: "2026-06-30", reportedValue: { raw: 66987000000 } },
        ],
      },
      {
        meta: { type: ["annualOperatingCashFlow"] },
        annualOperatingCashFlow: [
          { asOfDate: "2023-06-30", reportedValue: { raw: 87582000000 } },
          { asOfDate: "2024-06-30", reportedValue: { raw: 118548000000 } },
          { asOfDate: "2025-06-30", reportedValue: { raw: 136162000000 } },
          { asOfDate: "2026-06-30", reportedValue: { raw: 182935000000 } },
        ],
      },
      {
        meta: { type: ["quarterlyTotalRevenue"] },
        quarterlyTotalRevenue: [
          { asOfDate: "2025-12-31", reportedValue: { raw: 81273000000 } },
          { asOfDate: "2026-03-31", reportedValue: { raw: 82886000000 } },
        ],
      },
    ],
  },
};

describe("Yahoo fundamentals timeseries", () => {
  it("builds FY + Q series with TIER_2 provenance so Quality can score 3Y cash/growth", () => {
    const series = parseYahooTimeseries(MSFT_FIXTURE);
    assert.ok(series);
    const fy = series.points.filter((p) => p.periodType === "FY");
    assert.equal(fy.length, 4);
    assert.equal(fy.at(-1)?.revenue, 331839000000);
    assert.equal(fy.at(-1)?.fcf, 66987000000);
    assert.equal(fy.at(-1)?.cfo, 182935000000);
    assert.equal(series.points.filter((p) => p.periodType === "Q").length, 2);
    assert.ok(series.provenance?.every((p) => p.sourceTier === "TIER_2"));
  });

  it("fills latest FY into financial snapshot without inventing TTM", () => {
    const series = parseYahooTimeseries(MSFT_FIXTURE);
    const fin = financialsFromSeries(series);
    assert.equal(fin.revenueTtm, 331839000000);
    assert.equal(fin.revenuePrior, 281724000000);
    assert.equal(fin.cfo, 182935000000);
    assert.equal(fin.fcfSource, "REPORTED");
  });
});
