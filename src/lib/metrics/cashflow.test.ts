import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveMetrics } from "./derived.ts";
import { QUALITY_FACTORS, scoreQuality } from "../engines/quality.ts";
import { emptyFinancials, financialsFromNasdaq } from "../research/quote-parse.ts";
import type { FinancialSnapshot } from "../types.ts";

function derived(financials: FinancialSnapshot) {
  return deriveMetrics({
    price: 10,
    marketCap: 1_000_000_000,
    enterpriseValue: 1_000_000_000,
    financials,
    industryGroup: "other",
  });
}

describe("CFO / FCF semantic split", () => {
  it("Test A: CFO=100 FCF=null stays split", () => {
    const m = derived({ ...emptyFinancials(), revenueTtm: 1000, netIncomeTtm: 80, cfo: 100, fcf: null });
    assert.equal(m.cfo, 100);
    assert.equal(m.fcf, null);
    assert.equal(m.cfoMargin, 0.1);
    assert.equal(m.fcfMargin, null);
  });

  it("Test B: CFO=null FCF=70 does not fill CFO", () => {
    const m = derived({ ...emptyFinancials(), revenueTtm: 1000, netIncomeTtm: 80, cfo: null, fcf: 70 });
    assert.equal(m.cfo, null);
    assert.equal(m.fcf, 70);
    assert.equal(m.cfoMargin, null);
    assert.equal(m.fcfMargin, 0.07);
  });

  it("never falls back CFO from FCF or FCF from CFO", () => {
    const onlyFcf = derived({ ...emptyFinancials(), fcf: 9 });
    assert.equal(onlyFcf.cfo, null);
    const onlyCfo = derived({ ...emptyFinancials(), cfo: 11 });
    assert.equal(onlyCfo.fcf, null);
  });
});

describe("Nasdaq OCF mapping", () => {
  it("Test C: Net Cash Flow-Operating → cfo, fcf null without CAPEX", () => {
    const fin = financialsFromNasdaq({
      data: {
        incomeStatementTable: {
          rows: [{ value1: "Total Revenue", value2: "$1,000", value3: "$900" }],
        },
        cashFlowTable: {
          rows: [{ value1: "Net Cash Flow-Operating", value2: "$500", value3: "$400" }],
        },
      },
    });
    assert.ok(fin);
    assert.equal(fin.cfo, 500_000);
    assert.equal(fin.fcf, null);
    assert.equal(fin.fcfSource, null);
  });

  it("derives FCF from CFO − |CAPEX| with provenance", () => {
    const fin = financialsFromNasdaq({
      data: {
        incomeStatementTable: {
          rows: [{ value1: "Total Revenue", value2: "$1,000", value3: "$900" }],
        },
        cashFlowTable: {
          rows: [
            { value1: "Net Cash Flow-Operating", value2: "$500", value3: "$400" },
            { value1: "Capital Expenditures", value2: "-$120", value3: "-$80" },
          ],
        },
      },
    });
    assert.ok(fin);
    assert.equal(fin.cfo, 500_000);
    assert.equal(fin.fcf, 500_000 - 120_000);
    assert.equal(fin.fcfSource, "CFO_MINUS_CAPEX");
  });
});

describe("Quality 70 CFO vs FCF factors", () => {
  it("CFO present / FCF missing: Q17 Q18 Q22 may score, Q19 Q24 Q57 N/A", () => {
    const m = derived({
      ...emptyFinancials(),
      revenueTtm: 1000,
      netIncomeTtm: 80,
      cfo: 100,
      fcf: null,
    });
    const q = scoreQuality(m);
    const byId = Object.fromEntries(q.factors.concat(q.diagnostics).map((f) => [f.id, f]));
    assert.notEqual(byId.Q17?.score, null);
    assert.notEqual(byId.Q18?.score, null);
    assert.equal(byId.Q22?.score, 8);
    assert.equal(byId.Q19?.score, null);
    assert.equal(byId.Q24?.score, null);
    assert.equal(byId.Q57?.score, null);
    assert.equal(QUALITY_FACTORS.find((f) => f.id === "Q20")?.score(m).score, null);
    assert.equal(QUALITY_FACTORS.find((f) => f.id === "Q41")?.score({ ...m, roic: 0.4 }).score, null);
  });

  it("FCF present / CFO missing: FCF factors may score, CFO factors N/A", () => {
    const m = derived({
      ...emptyFinancials(),
      revenueTtm: 1000,
      netIncomeTtm: 80,
      cfo: null,
      fcf: 70,
    });
    const q = scoreQuality(m);
    const byId = Object.fromEntries(q.factors.map((f) => [f.id, f]));
    assert.equal(byId.Q17?.score, null);
    assert.equal(byId.Q18?.score, null);
    assert.equal(byId.Q22?.score, null);
    assert.notEqual(byId.Q19?.score, null);
    assert.notEqual(byId.Q24?.score, null);
    assert.notEqual(byId.Q57?.score, null);
  });
});
