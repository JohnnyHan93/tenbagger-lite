import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSql, type Sql } from "../db.ts";
import { emptyFinancials } from "../research/quote-parse.ts";
import type { Company, Evidence } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { insertAnalysis, saveAnalysisTransaction, saveCompany } from "./repo.ts";

function wrapFailOnNthEvidence(sql: Sql, n: number): Sql {
  let count = 0;
  const wrap = (inner: Sql): Sql => {
    const tagged = (async (strings: TemplateStringsArray, ...values: unknown[]) =>
      inner(strings, ...values)) as Sql;
    tagged.query = async (text, params) => {
      if (/insert into evidences/i.test(text)) {
        count += 1;
        if (count >= n) throw new Error("forced evidence failure");
      }
      return inner.query(text, params);
    };
    tagged.transaction = (fn) => inner.transaction((tx) => fn(wrap(tx)));
    return tagged;
  };
  return wrap(sql);
}

function ev(id: string): Evidence {
  return {
    id,
    factorCode: "F1",
    evidence: "fixture",
    evidenceType: "FACT",
    sourceName: "test",
    sourceUrl: "https://example.com/ev",
    sourceDate: "2026-09-04",
    confidence: 0.5,
    createdAt: "2026-09-04T00:00:00.000Z",
  };
}

function company(id: string, ticker: string): Company {
  return {
    id,
    ticker,
    exchange: "NASDAQ",
    companyName: ticker,
    country: "US",
    sector: "Technology",
    industry: "Software",
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
  };
}

function snap(id: string, companyId: string, evidence: Evidence[]): Snapshot {
  return {
    id,
    companyId,
    asOf: "2026-09-04",
    createdAt: "2026-09-04T00:00:00.000Z",
    price: 1,
    marketCap: 1,
    enterpriseValue: 1,
    currency: "USD",
    financials: emptyFinancials(),
    derived: { industryGroup: "other" } as Snapshot["derived"],
    evidence,
    xbagger: { version: "XBG-v2.0" } as Snapshot["xbagger"],
    oversold: { version: "OSM-v2.1" } as Snapshot["oversold"],
    quality: { version: "MFC70-v1.2" } as Snapshot["quality"],
    lenses: [],
    tags: [],
    researchPriority: null,
    researchPriorityParts: null,
    oneSentenceThesis: "",
    catalysts: [],
    risks: [],
    nextProof: [],
    killCriteria: [],
    findings: [],
    overallCoverage: 0.4,
    overallConfidence: "Low",
    researchProvider: "test",
    tenxMath: null,
    tenxScenarios: [],
  };
}

describe("transactional analysis persist", () => {
  it("commits company + analysis + evidence together", async () => {
    const sql = await getSql();
    const c = company(`c_ok_${Date.now()}`, "TXOK");
    const s = snap(`snap_ok_${Date.now()}`, c.id, [ev(`e_ok_1_${Date.now()}`), ev(`e_ok_2_${Date.now()}`)]);
    await saveAnalysisTransaction({ company: c, snapshot: s, sql });
    const companies = await sql.query<{ id: string }>("select id from companies where id = $1", [c.id]);
    const analyses = await sql.query<{ id: string }>("select id from analyses where id = $1", [s.id]);
    const evidences = await sql.query<{ id: string }>("select id from evidences where analysis_id = $1", [s.id]);
    assert.equal(companies.length, 1);
    assert.equal(analyses.length, 1);
    assert.equal(evidences.length, 2);
  });

  it("rolls back company and analysis when evidence #2 fails", async () => {
    const sql = await getSql();
    const c = company(`c_rb_${Date.now()}`, "TXRB");
    const s = snap(`snap_rb_${Date.now()}`, c.id, [ev(`e_rb_1_${Date.now()}`), ev(`e_rb_2_${Date.now()}`)]);
    const wrapped = wrapFailOnNthEvidence(sql, 2);
    await assert.rejects(() => saveAnalysisTransaction({ company: c, snapshot: s, sql: wrapped }), /forced evidence failure/);
    const companies = await sql.query<{ id: string }>("select id from companies where id = $1", [c.id]);
    const analyses = await sql.query<{ id: string }>("select id from analyses where id = $1", [s.id]);
    const evidences = await sql.query<{ id: string }>("select id from evidences where analysis_id = $1", [s.id]);
    assert.equal(companies.length, 0);
    assert.equal(analyses.length, 0);
    assert.equal(evidences.length, 0);
  });

  it("insertAnalysis without outer sql still wraps evidence in a transaction", async () => {
    const sql = await getSql();
    const c = company(`c_ia_${Date.now()}`, "TXIA");
    await saveCompany(c, sql);
    const s = snap(`snap_ia_${Date.now()}`, c.id, [ev(`e_ia_1_${Date.now()}`)]);
    await insertAnalysis(s);
    const analyses = await sql.query<{ id: string }>("select id from analyses where id = $1", [s.id]);
    assert.equal(analyses.length, 1);
  });
});
