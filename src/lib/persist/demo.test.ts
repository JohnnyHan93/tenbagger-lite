import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyCompany,
  isFakeDemoCompany,
  isFakeDemoSnapshot,
  isFakeDemoUniverse,
} from "../demo.ts";
import {
  identityUniverseWorkspace,
  mergeIdentityUniverse,
  stripDemoFromWorkspace,
} from "../bootstrap.ts";
import { SAMPLE_RESEARCH_100, sampleResearch100Stats } from "../sample-research-100.ts";
import { buildSampleWorld } from "../samples.ts";
import { runSnapshotFromDraft } from "../engines/run.ts";
import { FACTOR_ORDER } from "../scoring/config.ts";
import { emptyFinancials } from "../research/quote-parse.ts";
import type { ResearchDraft } from "../types.ts";

describe("fake demo classifier", () => {
  it("flags Sample Six fictional names and tickers", () => {
    const world = buildSampleWorld();
    assert.equal(world.companies.length, 6);
    assert.ok(world.companies.every(isFakeDemoCompany));
    assert.ok(world.companies.some((c) => c.ticker === "SMPL-SOFT"));
    assert.ok(world.companies.some((c) => c.companyName.includes("에코반도체장비")));
    assert.ok(world.companies.some((c) => c.companyName.includes("한강생활")));
    assert.ok(world.companies.some((c) => c.companyName.includes("서해모빌리티")));
    assert.equal(classifyCompany(world.companies[0]!), "FAKE_DEMO");
  });

  it("does not flag real identity companies", () => {
    const innod = SAMPLE_RESEARCH_100.find((c) => c.ticker === "INOD")!;
    const samsung = SAMPLE_RESEARCH_100.find((c) => c.ticker === "005930.KS")!;
    const mobis = SAMPLE_RESEARCH_100.find((c) => c.ticker === "012330.KS")!;
    assert.equal(isFakeDemoCompany(innod), false);
    assert.equal(isFakeDemoCompany(samsung), false);
    assert.equal(isFakeDemoCompany(mobis), false);
    assert.equal(mobis.companyName, "현대모비스");
  });
});

describe("application init does not recreate fake demo", () => {
  it("identity universe has 100 names, 50/50, zero analyses", () => {
    const world = identityUniverseWorkspace();
    const stats = sampleResearch100Stats(world.companies);
    assert.equal(stats.total, 100);
    assert.equal(stats.us, 50);
    assert.equal(stats.kr, 50);
    assert.equal(world.snapshots.length, 0);
    assert.equal(world.companies.filter(isFakeDemoCompany).length, 0);
    assert.equal(world.companies.filter((c) => c.companyName.includes("(SAMPLE)")).length, 0);
    assert.ok(!world.companies.some((c) => /에코반도체장비|한강생활|서해모빌리티|Northline|Harbor Brands|Redridge/.test(c.companyName)));
  });

  it("stripDemo removes Sample Six and keeps identity 100", () => {
    const fake = buildSampleWorld();
    const ident = identityUniverseWorkspace();
    const mixed = {
      companies: [...ident.companies, ...fake.companies],
      snapshots: [...ident.snapshots, ...fake.snapshots],
      universes: [
        ...ident.universes,
        {
          id: "u_sample",
          name: "Sample Six (fixtures)",
          version: 1,
          market: "GLOBAL" as const,
          status: "open" as const,
          createdAt: "2026-09-03T00:00:00.000Z",
          lockedAt: null,
          tickers: fake.companies.map((c) => ({ ticker: c.ticker, name: c.companyName })),
        },
      ],
      watchlist: fake.companies.map((c) => c.id),
      audit: [],
      settings: ident.settings,
    };
    const { next, report } = stripDemoFromWorkspace(mixed);
    assert.equal(report.companiesRemoved, 6);
    assert.ok(report.analysesRemoved >= 6);
    assert.equal(report.universesRemoved, 1);
    assert.equal(next.companies.filter(isFakeDemoCompany).length, 0);
    assert.equal(sampleResearch100Stats(next.companies).total, 100);
    assert.equal(next.snapshots.length, 0);
    assert.equal(isFakeDemoUniverse({ id: "u_sample", name: "Sample Six (fixtures)" }), true);
  });
});

function grokDraft(): ResearchDraft {
  const fin = {
    ...emptyFinancials(),
    revenueTtm: 100,
    netIncomeTtm: 8,
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
      score: 8,
      summary: `draft-${c}`,
      confidence: "High" as const,
    })),
    redFlags: [],
    tenxScenarios: [],
    catalysts: ["C1"],
    risks: [],
    nextProof: [],
    killCriteria: [],
    thesis: "real grok",
    evidences: [
      {
        id: "E1",
        factorCode: "F1",
        evidence: "E1",
        evidenceType: "FACT",
        sourceName: "10-K",
        sourceUrl: "https://example.com/e1",
        sourceDate: "2026-09-01",
        confidence: 0.9,
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

describe("cleanup preserves real grok research", () => {
  it("does not classify grok snapshot as fake demo", () => {
    const company = SAMPLE_RESEARCH_100.find((c) => c.ticker === "INOD")!;
    const snap = runSnapshotFromDraft({
      company,
      draft: grokDraft(),
      asOf: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(isFakeDemoSnapshot(snap, company), false);
    const { next } = stripDemoFromWorkspace({
      companies: [company],
      snapshots: [snap],
      universes: [],
      watchlist: [company.id],
      audit: [],
      settings: null,
    });
    assert.equal(next.snapshots.length, 1);
    assert.equal(next.companies.length, 1);
  });
});

describe("database cleanup is targeted", () => {
  it("removes Sample Six, keeps grok INOD, identity seed has 0 pre-seeded scores", async () => {
    const { persistWorkspace, loadWorkspace, clearWorkspace, cleanupDemoData } = await import("./repo.ts");
    await clearWorkspace();
    const fake = buildSampleWorld();
    const innod = {
      id: "c_INOD",
      ticker: "INOD",
      exchange: "NASDAQ",
      companyName: "Innodata Inc.",
      country: "US",
      sector: "Technology",
      industry: "EDP Services",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    const grok = runSnapshotFromDraft({
      company: innod,
      draft: grokDraft(),
      asOf: "2026-09-01T00:00:00.000Z",
    });
    await persistWorkspace({
      companies: [...fake.companies, innod],
      snapshots: [...fake.snapshots, grok],
      universes: [
        {
          id: "u_sample",
          name: "Sample Six (fixtures)",
          version: 1,
          market: "GLOBAL",
          status: "open",
          createdAt: "2026-09-03T00:00:00.000Z",
          lockedAt: null,
          tickers: fake.companies.map((c) => ({ ticker: c.ticker, name: c.companyName })),
        },
      ],
      watchlist: fake.companies.map((c) => c.id),
      audit: [],
      settings: {
        defaultResearchMode: "auto",
        useAi: false,
        researchPriorityOn: true,
        qualityModel: "MFC70-v1.2",
      },
    });
    const report = await cleanupDemoData();
    assert.equal(report.companiesRemoved, 6);
    assert.ok(report.analysesRemoved >= 6);
    assert.equal(report.universesRemoved, 1);
    assert.equal(report.realUserRecordsAffected, 0);
    assert.equal(report.status, "PASS");

    const after = await loadWorkspace();
    assert.equal(after.companies.filter(isFakeDemoCompany).length, 0);
    assert.ok(after.companies.some((c) => c.ticker === "INOD"));
    assert.equal(after.snapshots.length, 1);
    assert.equal(after.snapshots[0]!.researchProvider, "grok-4.5");

    const merged = mergeIdentityUniverse({
      companies: after.companies,
      snapshots: after.snapshots,
      universes: after.universes,
      watchlist: after.watchlist,
      audit: after.audit,
      settings: after.settings,
    });
    const stats = sampleResearch100Stats(merged.companies);
    assert.equal(stats.total, 100);
    assert.equal(stats.us, 50);
    assert.equal(stats.kr, 50);
    await persistWorkspace({
      companies: merged.companies,
      snapshots: merged.snapshots,
      universes: merged.universes,
      watchlist: merged.watchlist,
      audit: merged.audit,
      settings: merged.settings,
    });
    const seeded = await loadWorkspace();
    const identStats = sampleResearch100Stats(seeded.companies);
    assert.equal(identStats.total, 100);
    assert.equal(identStats.us, 50);
    assert.equal(identStats.kr, 50);
    assert.equal(seeded.snapshots.length, 1);
    assert.ok(!seeded.companies.some((c) => /에코반도체장비|한강생활|서해모빌리티/.test(c.companyName)));
  });

  it("clean database + identity seed has zero analyses", async () => {
    const { persistWorkspace, loadWorkspace, clearWorkspace, cleanupDemoData } = await import("./repo.ts");
    await clearWorkspace();
    const empty = await loadWorkspace();
    assert.equal(empty.companies.filter(isFakeDemoCompany).length, 0);
    assert.equal(empty.snapshots.length, 0);
    const report = await cleanupDemoData();
    assert.equal(report.companiesRemoved, 0);
    const world = identityUniverseWorkspace();
    await persistWorkspace({
      companies: world.companies,
      snapshots: world.snapshots,
      universes: world.universes,
      watchlist: world.watchlist,
      audit: world.audit,
      settings: world.settings,
    });
    const seeded = await loadWorkspace();
    const stats = sampleResearch100Stats(seeded.companies);
    assert.equal(stats.total, 100);
    assert.equal(stats.us, 50);
    assert.equal(stats.kr, 50);
    assert.equal(seeded.snapshots.length, 0);
    const evidence = seeded.snapshots.reduce((n, s) => n + (s.evidence?.length ?? 0), 0);
    assert.equal(evidence, 0);
  });
});
