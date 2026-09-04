import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { industryGroupOf, naForGroup } from "./industry.ts";
import { scoreQuality } from "./quality.ts";
import { scoreOversold } from "./oversold.ts";
import { lookupIdentity, overlayIdentity, SMOKE_12 } from "../research/identity.ts";
import { financialsFromWiseReport, parseWiseReportNumber } from "../research/quote-parse.ts";
import { stampEvidence } from "../research/heuristic.ts";
import { diffSnapshots } from "./diff.ts";
import type { DerivedMetrics } from "../metrics/derived.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import type { Evidence } from "../types.ts";

function metrics(group: DerivedMetrics["industryGroup"], extra: Partial<DerivedMetrics> = {}): DerivedMetrics {
  return {
    revenueTtm: 100,
    revenuePrior: 80,
    revenueYoY: 0.25,
    revenueCagr3y: null,
    opTtm: 10,
    opPrior: null,
    opGrowth: null,
    niTtm: 8,
    gm: 0.4,
    om: 0.1,
    nm: 0.08,
    gmChange: null,
    omChange: null,
    fcf: 5,
    cfo: 6,
    fcfMargin: 0.05,
    cfoMargin: 0.06,
    cashConversion: 0.75,
    accrual: null,
    cash: 40,
    debt: 20,
    netDebt: -20,
    netDebtEbitda: 1,
    interestCoverage: 8,
    assets: 80,
    cashToAssets: 0.5,
    stDebtToCash: null,
    shares: 10,
    shareGrowth: 0.02,
    arGrowthGap: null,
    invGrowthGap: null,
    cccChange: null,
    capex: 4,
    capexToRev: 0.04,
    rdToRev: 0.1,
    rdGrowth: null,
    backlogGrowth: null,
    bookToBill: null,
    roic: 0.12,
    roicChange: null,
    assetTurnover: 1.2,
    drawdown52w: 0.1,
    return3m: null,
    return6m: null,
    marketCap: 500,
    enterpriseValue: 460,
    pe: 20,
    evSales: 4.6,
    evEbitda: null,
    pb: 1.1,
    customerConcentration: 0.2,
    industryGroup: group,
    high52w: 12,
    price: 10,
    ...extra,
  };
}

describe("smoke 12 adapters", () => {
  it("maps all 12 identities", () => {
    const expectMap: Record<string, string> = {
      MSFT: "Software",
      NVDA: "Semiconductor",
      INOD: "Software",
      ASTS: "Telecom",
      UNH: "Healthcare",
      JPM: "Financial",
      PLD: "REIT",
      "005930.KS": "Semiconductor",
      "267260.KS": "Industrial",
      "196170.KQ": "Biotech",
      "105560.KS": "Financial",
      "356680.KQ": "Cybersecurity",
    };
    for (const [t, adapter] of Object.entries(expectMap)) {
      const ident = lookupIdentity(t);
      assert.ok(ident, t);
      assert.equal(ident!.adapter, adapter, t);
    }
    assert.equal(SMOKE_12.length, 12);
  });

  it("does not classify ASTS as generic industrial or consumer", () => {
    assert.equal(industryGroupOf("Consumer Discretionary", "Telecommunications Equipment"), "other");
    assert.equal(lookupIdentity("ASTS")!.group, "other");
  });

  it("software / semi / healthcare / financial / reit / biotech / industrial / cyber", () => {
    assert.equal(industryGroupOf("Technology", "Computer Software: Prepackaged Software"), "saas");
    assert.equal(industryGroupOf("Technology", "Semiconductors"), "semi");
    assert.equal(industryGroupOf("Health Care", "Managed Health Care"), "healthcare");
    assert.equal(industryGroupOf("Financials", "Banks"), "financial");
    assert.equal(industryGroupOf("Real Estate", "REIT Industrial"), "reit");
    assert.equal(industryGroupOf("Health Care", "Biotechnology"), "pharma");
    assert.equal(industryGroupOf("Industrials", "Electrical Equipment"), "industrial");
    assert.equal(industryGroupOf("Technology", "Cybersecurity"), "saas");
  });
});

describe("financial / REIT / biotech adapters", () => {
  it("does not force bank manufacturing leverage/ROIC", () => {
    assert.equal(naForGroup("financial", "de"), "N");
    assert.equal(naForGroup("financial", "roic"), "N");
    const q = scoreQuality(metrics("financial"));
    const nd = q.factors.find((f) => f.id === "Q30");
    const roic = q.factors.find((f) => f.id === "Q13");
    assert.equal(nd?.applicability, "N");
    assert.equal(nd?.score, null);
    assert.equal(roic?.applicability, "N");
    assert.ok(q.eligibleCount < 70);
  });

  it("REIT skips ordinary P/E in oversold valuation", () => {
    const withPe = scoreOversold(metrics("reit", { pe: 8, evSales: null, pb: null }));
    assert.equal(withPe.valuation, null);
    assert.match(withPe.reasons.valuation, /P\/E 강제 없음|FFO/);
    const withPb = scoreOversold(metrics("reit", { pe: 8, evSales: null, pb: 0.9 }));
    assert.ok(withPb.valuation != null);
    assert.match(withPb.reasons.valuation, /P\/B/);
    assert.ok(!/P\/E/.test(withPb.reasons.valuation));
  });

  it("biotech inventory is conditional not forced manufacturing", () => {
    assert.equal(naForGroup("pharma", "inventory"), "C");
    assert.equal(naForGroup("pharma", "roic"), "C");
    const q = scoreQuality(metrics("pharma", { invGrowthGap: null, roic: null }));
    const inv = q.factors.find((f) => f.id === "Q26");
    const roic = q.factors.find((f) => f.id === "Q13");
    assert.equal(inv?.score, null);
    assert.equal(roic?.score, null);
  });

  it("N/A is not 0 and not 5 for oversold", () => {
    const o = scoreOversold(metrics("saas", { drawdown52w: null, return3m: null, return6m: null }));
    assert.equal(o.oversold, null);
    assert.notEqual(o.oversold, 0);
    assert.notEqual(o.oversold, 5);
  });
});

describe("evidence stamp", () => {
  it("fills tier, engines, factor targets, status, dates", () => {
    const e = stampEvidence({
      id: "e1",
      factorCode: "F8",
      evidence: "mcap",
      evidenceType: "FACT",
      sourceName: "Market quote",
      sourceUrl: "https://example.com",
      sourceDate: "2026-09-04",
      confidence: 0.9,
      createdAt: "2026-09-04T00:00:00.000Z",
    } as Evidence);
    assert.equal(e.sourceTier, "TIER_2");
    assert.ok(e.engineTargets?.includes("xbagger"));
    assert.deepEqual(e.factorTargets, ["F8"]);
    assert.equal(e.status, "ACTIVE");
    assert.equal(e.sourceDate, "2026-09-04");
    assert.ok(e.statement);
  });
});

describe("wise report parser", () => {
  it("reads 억원 annuals and ignores current-year forecast", () => {
    const html = `
      <table>
        <tr><th>2024/12(IFRS연결)</th><th>2025/12(IFRS연결)</th><th>2026/12(IFRS연결)</th></tr>
        <tr><th>매출액</th><td>3,008,709</td><td>3,336,059</td><td>860,617</td></tr>
        <tr><th>영업이익</th><td>327,260</td><td>436,011</td><td>121,661</td></tr>
        <tr><th>당기순이익</th><td>344,514</td><td>452,068</td><td>122,257</td></tr>
        <tr><th>FCF</th><td>215,763</td><td>377,930</td><td>134,328</td></tr>
        <tr><th>이자발생부채</th><td>193,302</td><td>252,391</td><td>166,723</td></tr>
        <tr><th>영업이익률</th><td>10.88</td><td>13.07</td><td>14.14</td></tr>
      </table>
    `;
    const fin = financialsFromWiseReport(html, new Date("2026-09-04T00:00:00Z"));
    assert.ok(fin);
    assert.equal(fin!.revenueTtm, 3_336_059 * 1e8);
    assert.equal(fin!.revenuePrior, 3_008_709 * 1e8);
    assert.ok(fin!.operatingMargin != null && Math.abs(fin!.operatingMargin - 0.1307) < 0.001);
    assert.equal(parseWiseReportNumber("(12.3)"), -12.3);
  });
});

describe("snapshot diff", () => {
  it("reports 0 deltas when equal, and new evidence ids", () => {
    const snap = {
      id: "a",
      companyId: "c",
      asOf: "2026-09-04T00:00:00.000Z",
      createdAt: "2026-09-04T00:00:00.000Z",
      price: 1,
      marketCap: 1,
      enterpriseValue: 1,
      currency: "USD",
      financials: {} as Snapshot["financials"],
      derived: metrics("saas"),
      evidence: [{ id: "e1" } as Evidence],
      xbagger: { adjustedScore: 50, coverage: 0.8, factors: [{ id: "X01", score: 6 }] },
      oversold: { opportunity: 5, coverage: 0.9 },
      quality: { score: 60, coverage: 0.7, factors: [{ id: "Q01", score: 8 }] },
      overallCoverage: 0.8,
      overallConfidence: "Medium",
    } as unknown as Snapshot;
    const same = diffSnapshots(snap, { ...snap, id: "b" });
    assert.equal(same.scoreDelta.xbagger, 0);
    assert.equal(same.coverageDelta.overall, 0);
    assert.equal(same.factorChanges.length, 0);
    const next = {
      ...snap,
      id: "c2",
      evidence: [{ id: "e1" } as Evidence, { id: "e2" } as Evidence],
      xbagger: { ...snap.xbagger, adjustedScore: 55, factors: [{ id: "X01", score: 8 }] },
    } as unknown as Snapshot;
    const d = diffSnapshots(snap, next);
    assert.equal(d.scoreDelta.xbagger, 5);
    assert.deepEqual(d.evidenceAdded, ["e2"]);
    assert.ok(d.factorChanges.some((f) => f.id === "X01"));
  });
});

describe("identity overlay", () => {
  it("fills empty KR sector from identity", () => {
    const q = overlayIdentity({
      ticker: "005930.KS",
      companyName: "005930.KS",
      sector: "",
      industry: "",
      country: "KR",
      exchange: "",
    });
    assert.equal(q.companyName, "삼성전자");
    assert.equal(q.sector, "Information Technology");
    assert.equal(q.adapter, "Semiconductor");
  });
});
