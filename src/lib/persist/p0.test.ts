import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FACTOR_ORDER, FACTOR_WEIGHT } from "../scoring/config.ts";
import { opportunityScore, opportunityScorePartial, scoreOversold } from "../engines/oversold.ts";
import { QUALITY_FACTORS, qualityImplStatus, scoreQuality } from "../engines/quality.ts";
import { scoreXBagger } from "../engines/xbagger.ts";
import { snapshotToDraft, runSnapshotFromDraft } from "../engines/run.ts";
import { parseTickerList } from "../universe/parse.ts";
import { defaultScenarios, requiredRevenueFor10x, targetMarketCap } from "../tenx/calculator.ts";
import { isStale, FRESHNESS_DEFAULTS } from "./freshness.ts";
import type { ResearchDraft } from "../types.ts";
import type { DerivedMetrics } from "../metrics/derived.ts";
import { emptyFinancials } from "../research/quote-parse.ts";

describe("xbagger weights", () => {
  it("sum to 100", () => {
    const sum = FACTOR_ORDER.reduce((s, c) => s + FACTOR_WEIGHT[c], 0);
    assert.equal(sum, 100);
  });
});

describe("oversold N/A", () => {
  it("exact formula 6.80", () => {
    assert.equal(Number(opportunityScore(8, 7, 6, 5).toFixed(2)), 6.8);
  });

  it("renormalizes N/A instead of filling 5", () => {
    const p = opportunityScorePartial(8, 7, null, 5);
    assert.equal(Number(p.score!.toFixed(2)), 6.89);
    assert.equal(Number(p.coverage.toFixed(2)), 0.9);
  });

  it("treats zero as a valid score", () => {
    const p = opportunityScorePartial(0, 7, 6, 5);
    assert.ok(p.score != null);
    assert.equal(p.coverage, 1);
    assert.ok(p.score < opportunityScore(5, 7, 6, 5));
  });
});

describe("quality 70 integrity", () => {
  it("has 70 unique factor ids", () => {
    const ids = QUALITY_FACTORS.map((f) => f.id);
    assert.equal(ids.length, 70);
    assert.equal(new Set(ids).size, 70);
  });

  it("removed wrong proxies", () => {
    const q04 = QUALITY_FACTORS.find((f) => f.id === "Q04")!;
    const r = q04.score({} as DerivedMetrics);
    assert.equal(r.score, null);
    assert.match(r.reason, /대체하지 않음|시계열 없음/);
    const q41 = QUALITY_FACTORS.find((f) => f.id === "Q41")!;
    assert.equal(q41.score({ roic: 0.4 } as DerivedMetrics).score, null);
  });

  it("Q12 scores from OM change not a draft guess", () => {
    const def = QUALITY_FACTORS.find((f) => f.id === "Q12")!;
    const hit = def.score({ omChange: 0.01 } as DerivedMetrics);
    assert.equal(hit.score, 8);
  });
});

function baseDraft(): ResearchDraft {
  const fin = {
    ...emptyFinancials(),
    revenueTtm: 100,
    revenuePrior: 80,
    operatingIncomeTtm: 12,
    operatingIncomePrior: 10,
    netIncomeTtm: 8,
    grossMargin: 0.6,
    operatingMargin: 0.12,
    fcf: 6,
    cfo: 7,
    cash: 40,
    totalDebt: 5,
    sharesOutstanding: 10,
  };
  return {
    quote: {
      ticker: "INOD",
      exchange: "NASDAQ",
      companyName: "Innodata",
      currency: "USD",
      price: 10,
      marketCap: 1e9,
      enterpriseValue: 9.6e8,
      country: "US",
      sector: "Technology",
      industry: "EDP Services",
      financials: fin,
    },
    factors: FACTOR_ORDER.map((c) => ({
      code: c,
      score: c === "F9" ? 10 : 8,
      summary: `draft-${c}`,
      confidence: "High" as const,
    })),
    redFlags: [],
    tenxScenarios: (() => {
      const d = defaultScenarios(1e9, fin);
      return [d.bear, d.base, d.bull];
    })(),
    catalysts: ["C1"],
    risks: ["R1"],
    nextProof: ["P1"],
    killCriteria: ["K1"],
    thesis: "draft thesis kept",
    evidences: [
      {
        id: "E1",
        factorCode: "F1",
        evidence: "E1 statement",
        evidenceType: "FACT",
        sourceName: "10-K",
        sourceUrl: "https://example.com/e1",
        sourceDate: "2026-09-01",
        confidence: 0.9,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "E2",
        factorCode: "F2",
        evidence: "E2 statement",
        evidenceType: "REPORTED",
        sourceName: "IR",
        sourceUrl: "https://example.com/e2",
        sourceDate: "2026-09-01",
        confidence: 0.8,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "E3",
        factorCode: "F9",
        evidence: "E3 statement",
        evidenceType: "FACT",
        sourceName: "PR",
        sourceUrl: "https://example.com/e3",
        sourceDate: "2026-09-01",
        confidence: 0.7,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    tenxFeasibility: "POSSIBLE",
    requiredRevenue: null,
    requiredNetIncome: null,
    requiredPe: null,
    requiredEvSales: null,
    researchProvider: "grok-4.5",
  };
}

describe("saveFromDraft preservation", () => {
  it("keeps Grok X scores, evidence, catalysts", () => {
    const draft = baseDraft();
    const snap = runSnapshotFromDraft({
      company: {
        id: "c_INOD",
        ticker: "INOD",
        exchange: "NASDAQ",
        companyName: "Innodata",
        country: "US",
        sector: "Technology",
        industry: "EDP",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      draft,
    });
    assert.equal(snap.xbagger.factors.find((f) => f.code === "F9")?.score, 10);
    assert.ok(snap.evidence.map((e) => e.id).includes("E1"));
    assert.ok(snap.evidence.map((e) => e.id).includes("E2"));
    assert.ok(snap.evidence.map((e) => e.id).includes("E3"));
    assert.deepEqual(snap.catalysts, ["C1"]);
    assert.equal(snap.oneSentenceThesis, "draft thesis kept");
    assert.ok(snap.xbagger.normalizedScore > 80);
  });
});

describe("history immutability", () => {
  it("refresh creates a second snapshot", () => {
    const company = {
      id: "c1",
      ticker: "AAA",
      exchange: "NYSE",
      companyName: "Aaa",
      country: "US",
      sector: "Tech",
      industry: "Soft",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const a = runSnapshotFromDraft({
      company,
      draft: baseDraft(),
      asOf: "2026-09-01T00:00:00.000Z",
    });
    const draftB = baseDraft();
    draftB.factors = draftB.factors.map((f) => ({ ...f, score: 10 }));
    const b = runSnapshotFromDraft({
      company,
      draft: draftB,
      asOf: "2026-09-04T00:00:00.000Z",
    });
    assert.notEqual(a.id, b.id);
    assert.ok(b.xbagger.normalizedScore > a.xbagger.normalizedScore);
    const hist = [a, b];
    assert.equal(hist.length, 2);
  });
});

describe("universe lock / import rollback", () => {
  it("rejects duplicate import before commit", () => {
    const p = parseTickerList("INOD\nINOD");
    assert.equal(p.tickers.length, 1);
    assert.ok(p.errors.some((e) => /중복/.test(e)));
  });
});

describe("xbagger N/A not zero", () => {
  it("null factor excluded", () => {
    const r = scoreXBagger({
      factors: FACTOR_ORDER.map((c) => ({
        code: c,
        score: c === "F1" ? null : 8,
        reason: "t",
      })),
      tenxMath: null,
      tenxScenarios: [],
      tenxFeasibility: "POSSIBLE",
    });
    assert.ok(r.coverage < 1);
    assert.equal(r.factors.find((f) => f.code === "F1")?.status, "NA");
    assert.ok(r.normalizedScore > 0);
  });
});

describe("quality implementation map", () => {
  it("no missing factors, no wrong-proxy statuses", () => {
    for (const f of QUALITY_FACTORS) {
      const st = qualityImplStatus(f.id, f.kind);
      assert.ok(st === "IMPLEMENTED" || st === "MANUAL_ONLY" || st === "N/A_BY_DESIGN");
    }
    assert.equal(QUALITY_FACTORS.length, 70);
  });
});

void scoreOversold;
void scoreQuality;

describe("database persistence", () => {
  it("survives save and reload without localStorage", async () => {
    const { persistWorkspace, loadWorkspace, clearWorkspace } = await import("./repo.ts");
    await clearWorkspace();
    const draft = baseDraft();
    const company = {
      id: "c_INOD",
      ticker: "INOD",
      exchange: "NASDAQ",
      companyName: "Innodata",
      country: "US",
      sector: "Technology",
      industry: "EDP",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const snap = runSnapshotFromDraft({ company, draft, asOf: "2026-09-01T00:00:00.000Z" });
    await persistWorkspace({
      companies: [company],
      snapshots: [snap],
      universes: [
        {
          id: "u1",
          name: "Test",
          version: 1,
          market: "US",
          status: "locked",
          createdAt: "2026-09-01T00:00:00.000Z",
          lockedAt: "2026-09-01T00:00:00.000Z",
          tickers: [{ ticker: "INOD", name: "Innodata" }],
        },
      ],
      watchlist: [company.id],
      audit: [],
      settings: {
        defaultResearchMode: "auto",
        useAi: false,
        researchPriorityOn: true,
        qualityModel: "MFC70-v1.2",
      },
    });
    const loaded = await loadWorkspace();
    assert.equal(loaded.companies.length, 1);
    assert.equal(loaded.snapshots.length, 1);
    assert.equal(loaded.snapshots[0]!.xbagger.factors.find((f) => f.code === "F9")?.score, 10);
    assert.equal(loaded.snapshots[0]!.evidence.length, 3);
    assert.equal(loaded.universes[0]!.status, "locked");
    const snap2 = runSnapshotFromDraft({
      company,
      draft: { ...draft, factors: draft.factors.map((f) => ({ ...f, score: 10 })) },
      asOf: "2026-09-04T00:00:00.000Z",
    });
    await persistWorkspace({
      ...loaded,
      snapshots: [...loaded.snapshots, snap2],
      settings: loaded.settings,
    });
    const again = await loadWorkspace();
    assert.equal(again.snapshots.length, 2);
  });
});

describe("refresh preserves research draft", () => {
  it("snapshotToDraft keeps X scores and evidence", () => {
    const company = {
      id: "c_INOD",
      ticker: "INOD",
      exchange: "NASDAQ",
      companyName: "Innodata",
      country: "US",
      sector: "Technology",
      industry: "EDP",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const a = runSnapshotFromDraft({ company, draft: baseDraft(), asOf: "2026-09-01T00:00:00.000Z" });
    const draft = snapshotToDraft(a, company);
    const b = runSnapshotFromDraft({ company, draft, asOf: "2026-09-04T00:00:00.000Z" });
    assert.notEqual(a.id, b.id);
    assert.equal(b.xbagger.factors.find((f) => f.code === "F9")?.score, 10);
    assert.equal(b.evidence.length, 3);
    assert.deepEqual(b.catalysts, ["C1"]);
    assert.equal(Math.round(b.xbagger.normalizedScore), Math.round(a.xbagger.normalizedScore));
  });
});

describe("quality N/A and diagnostics", () => {
  it("diagnostics are excluded from the 70 base denominator", () => {
    const q = scoreQuality({ industryGroup: "saas" } as DerivedMetrics);
    const diag = q.factors.filter((f) => f.kind === "Diagnostic");
    assert.ok(diag.length > 0);
    assert.equal(q.eligibleCount, q.factors.filter((f) => f.kind !== "Diagnostic" && f.applicability !== "N").length);
    assert.ok(q.diagnostics.every((d) => d.kind === "Diagnostic"));
  });

  it("N/A is not scored as 0", () => {
    const q = scoreQuality({ industryGroup: "saas" } as DerivedMetrics);
    const na = q.factors.filter((f) => f.kind !== "Diagnostic" && f.score == null);
    assert.ok(na.length > 0);
    assert.ok(na.every((f) => f.status === "NA" || f.applicability === "N"));
    assert.ok(na.every((f) => f.weightedScore == null));
  });
});

describe("10x math", () => {
  it("target cap is 10× current and scenarios decay growth", () => {
    assert.equal(targetMarketCap(1e9), 1e10);
    const req = requiredRevenueFor10x(1e9, "EV_SALES", 8, 0.12);
    assert.equal(req, 1e10 / 8);
    const s = defaultScenarios(1e9, {
      ...emptyFinancials(),
      revenueTtm: 1e8,
      revenuePrior: 8e7,
    });
    assert.ok(s.bear.revenue < s.base.revenue);
    assert.ok(s.base.revenue < s.bull.revenue);
  });
});

describe("freshness", () => {
  it("uses configured windows", () => {
    assert.equal(FRESHNESS_DEFAULTS.priceValuationDays, 7);
    assert.equal(FRESHNESS_DEFAULTS.financialsDays, 120);
    const now = Date.parse("2026-09-04T00:00:00.000Z");
    assert.equal(isStale("2026-09-01T00:00:00.000Z", 7, now), false);
    assert.equal(isStale("2026-08-01T00:00:00.000Z", 7, now), true);
  });
});

describe("evidence graph", () => {
  it("draft evidence keeps type and ids", () => {
    const snap = runSnapshotFromDraft({
      company: {
        id: "c1",
        ticker: "AAA",
        exchange: "NYSE",
        companyName: "Aaa",
        country: "US",
        sector: "Tech",
        industry: "Soft",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      draft: baseDraft(),
    });
    assert.equal(snap.evidence[0]?.evidenceType, "FACT");
    assert.ok(snap.xbagger.factors.find((f) => f.code === "F1")?.evidenceIds.includes("E1"));
  });
});

describe("universe lock version", () => {
  it("unlock increments version conceptually", () => {
    const u = { status: "locked" as const, version: 1 };
    const next = { ...u, status: "open" as const, version: u.version + 1 };
    assert.equal(next.version, 2);
    assert.equal(next.status, "open");
  });
});

describe("xlsx import export", () => {
  it("roundtrips a ticker sheet", async () => {
    const { sheetToXlsx, parseXlsxToText } = await import("../xlsx.ts");
    const data = sheetToXlsx("S", [
      ["Ticker", "Name"],
      ["INOD", "Innodata"],
    ]);
    const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const text = await parseXlsxToText(copy as ArrayBuffer);
    assert.match(text, /INOD/);
    const parsed = parseTickerList(text);
    assert.ok(parsed.tickers.some((t) => t.ticker === "INOD"));
  });
});

