import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { financialsFromNaverAnnual, financialsFromWiseReport, extrasFromNaverAnnual, extrasFromWiseReport } from "./quote-parse.ts";
import { buildResearchGaps } from "./gaps.ts";
import { buildUniverseJobs, EXECUTE_FULL_100, preflight } from "./jobs.ts";
import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import type { Company } from "../types.ts";

describe("naver annual parser", () => {
  it("uses 억원 actuals and ignores consensus forecast year", () => {
    const payload = {
      financeInfo: {
        trTitleList: [
          { isConsensus: "N", title: "2024.12.", key: "202412" },
          { isConsensus: "N", title: "2025.12.", key: "202512" },
          { isConsensus: "Y", title: "2026.12.", key: "202612" },
        ],
        rowList: [
          {
            title: "매출액",
            columns: {
              "202412": { value: "3,008,709" },
              "202512": { value: "3,336,059" },
              "202612": { value: "7,397,268" },
            },
          },
          {
            title: "영업이익",
            columns: {
              "202412": { value: "327,260" },
              "202512": { value: "436,011" },
              "202612": { value: "3,933,479" },
            },
          },
          {
            title: "당기순이익",
            columns: {
              "202412": { value: "344,514" },
              "202512": { value: "452,068" },
              "202612": { value: "3,274,613" },
            },
          },
          {
            title: "영업이익률",
            columns: {
              "202412": { value: "10.88" },
              "202512": { value: "13.07" },
              "202612": { value: "53.17" },
            },
          },
        ],
      },
    };
    const fin = financialsFromNaverAnnual(payload, new Date("2026-09-04T00:00:00Z"));
    assert.ok(fin);
    assert.equal(fin!.revenueTtm, 3_336_059 * 1e8);
    assert.equal(fin!.revenuePrior, 3_008_709 * 1e8);
    assert.ok(fin!.operatingMargin != null && Math.abs(fin!.operatingMargin - 0.1307) < 0.001);
    const extras = extrasFromNaverAnnual(payload, new Date("2026-09-04T00:00:00Z"));
    assert.equal(extras.fiscalYear, 2025);
    assert.ok(extras.omChange != null && extras.omChange > 0);
  });
});

describe("wise report parser live header shape", () => {
  it("reads IFRS연결 year cells that are not leftmost labels", () => {
    const html = `
      <table>
        <tr><th>2024/12 (IFRS연결)</th><th>2025/12 (IFRS연결)</th><th>2026/12 (IFRS연결)</th></tr>
        <tr><th>매출액</th><td>3,008,709</td><td>3,336,059</td><td>860,617</td></tr>
        <tr><th>영업이익</th><td>327,260</td><td>436,011</td><td>121,661</td></tr>
        <tr><th>당기순이익</th><td>344,514</td><td>452,068</td><td>122,257</td></tr>
      </table>
    `;
    const fin = financialsFromWiseReport(html, new Date("2026-09-04T00:00:00Z"));
    assert.ok(fin);
    assert.equal(fin!.revenueTtm, 3_336_059 * 1e8);
    assert.equal(fin!.revenuePrior, 3_008_709 * 1e8);
  });

  it("ignores duplicated later year headers from the quarterly block", () => {
    const years = [
      "2022/12 (IFRS연결)",
      "2023/12 (IFRS연결)",
      "2024/12 (IFRS연결)",
      "2025/12 (IFRS연결)",
      "2026/12 (IFRS연결)",
      "2025/06 (IFRS연결)",
      "2026/03 (IFRS연결)",
      "2026/06 (IFRS연결)",
      "2025/09 (IFRS연결)",
      "2026/09 (IFRS연결)",
      "2025/09 (IFRS연결)",
      "2025/12 (IFRS연결)",
    ];
    const html = `
      <table>
        <tr>${years.map((y) => `<th>${y}</th>`).join("")}</tr>
        <tr><th>매출액</th><td>3,022,314</td><td>2,589,355</td><td>3,008,709</td><td>3,336,059</td><td>860,617</td><td>938,374</td><td>1,338,734</td><td>1,714,995</td></tr>
        <tr><th>영업이익</th><td>433,766</td><td>65,670</td><td>327,260</td><td>436,011</td><td>121,661</td><td>200,737</td><td>572,328</td><td>894,924</td></tr>
        <tr><th>당기순이익</th><td>556,541</td><td>154,871</td><td>344,514</td><td>452,068</td><td>122,257</td><td>196,417</td><td>472,253</td><td>716,245</td></tr>
        <tr><th>자산총계</th><td>4,484,245</td><td>4,559,060</td><td>5,145,319</td><td>5,669,421</td><td>5,236,596</td><td>5,669,421</td><td>6,333,396</td><td>7,594,805</td></tr>
        <tr><th>이자발생부채</th><td>103,332</td><td>126,859</td><td>193,302</td><td>252,391</td><td>166,723</td><td>252,391</td><td>281,388</td><td>224,087</td></tr>
        <tr><th>FCF</th><td>127,509</td><td>-134,739</td><td>215,763</td><td>377,930</td><td>134,328</td><td>172,504</td><td>231,471</td><td>909,733</td></tr>
        <tr><th>발행주식수(보통주)</th><td>5,969,782,550</td><td>5,969,782,550</td><td>5,969,782,550</td><td>5,919,637,922</td><td>5,919,637,922</td><td>5,919,637,922</td><td>5,919,637,922</td><td>5,846,278,608</td></tr>
      </table>
    `;
    const fin = financialsFromWiseReport(html, new Date("2026-09-04T00:00:00Z"));
    assert.ok(fin);
    assert.equal(fin!.revenueTtm, 3_336_059 * 1e8);
    assert.equal(fin!.fcf, 377_930 * 1e8);
    assert.equal(fin!.sharesOutstanding, 5_919_637_922);
    const extras = extrasFromWiseReport(html, new Date("2026-09-04T00:00:00Z"));
    assert.equal(extras.fiscalYear, 2025);
    assert.equal(extras.statementBasis, "연결");
    assert.equal(extras.assets, 5_669_421 * 1e8);
    assert.equal(extras.roic, null);
  });

  it("aligns labeled header rows to data columns", () => {
    const html = `
      <table>
        <tr><th>항목</th><th>2024/12 (IFRS연결)</th><th>2025/12 (IFRS연결)</th></tr>
        <tr><th>매출액</th><td>100</td><td>200</td></tr>
        <tr><th>영업이익</th><td>10</td><td>30</td></tr>
      </table>
    `;
    const fin = financialsFromWiseReport(html, new Date("2026-09-04T00:00:00Z"));
    assert.ok(fin);
    assert.equal(fin!.revenueTtm, 200 * 1e8);
    assert.equal(fin!.revenuePrior, 100 * 1e8);
  });
});

describe("research gaps", () => {
  it("ranks missing TAM and quality core above diagnostics", () => {
    const snap = {
      xbagger: {
        factors: [
          { id: "X01", code: "F1", name: "TAM", score: null, reason: "TAM 없음", weight: 12 },
          { id: "X02", code: "F2", name: "Growth", score: 6, reason: "ok", weight: 12 },
        ],
      },
      oversold: {
        fundamental: null,
        valuation: 5,
        oversold: 3,
        reasons: { fundamental: "매출 없음", valuation: "", oversold: "", risk: "", trap: "" },
      },
      quality: {
        factors: [
          { id: "Q01", name: "Revenue Growth", kind: "Core", status: "NA", applicability: "A", reason: "자료 없음" },
          { id: "Q70", name: "Diagnostic", kind: "Diagnostic", status: "NA", applicability: "A", reason: "skip" },
        ],
      },
    } as unknown as Snapshot;
    const gaps = buildResearchGaps(snap, { country: "KR" } as Company);
    assert.ok(gaps.length >= 2);
    assert.equal(gaps[0]!.impact, "HIGH");
    assert.ok(!gaps.some((g) => g.factor === "Q70"));
    assert.ok(gaps.some((g) => /DART/.test(g.nextSource)));
  });
});

describe("full 100 queue readiness", () => {
  it("does not auto-execute and counts remaining universe members", () => {
    assert.equal(EXECUTE_FULL_100, false);
    assert.equal(SAMPLE_RESEARCH_100.length, 100);
    const jobs = buildUniverseJobs([], []);
    assert.equal(jobs.length, 100);
    assert.ok(jobs.every((j) => j.status === "NOT_RESEARCHED"));
    const flight = preflight([], []);
    assert.equal(flight.executeFull100, false);
    assert.equal(flight.remaining, 100);
  });
});
