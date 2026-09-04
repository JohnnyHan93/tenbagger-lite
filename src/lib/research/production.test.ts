import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSql } from "../db.ts";
import type { Company, ResearchDraft } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { emptyFinancials } from "./quote-parse.ts";
import { FACTOR_ORDER } from "../scoring/config.ts";
import { defaultScenarios } from "../tenx/calculator.ts";
import { SAMPLE_RESEARCH_100, SAMPLE_RESEARCH_100_UNIVERSE_ID } from "../sample-research-100.ts";
import { remainingUniverseJobs, EXECUTE_FULL_100, FULL100_EXECUTION_DISABLED } from "./jobs.ts";
import {
  createProductionDeps,
  processFull100Chunk,
  startFull100FromWorkspace,
} from "./production.ts";
import { __resetRunnerControl, cancelResearchRun, pauseResearchRun, resumeResearchRun } from "./runner.ts";
import {
  listJobsForRun,
  listResearchRuns,
  queueTablesReady,
  updateResearchJob,
} from "../persist/queue.ts";
import { saveAnalysisTransaction } from "../persist/repo.ts";

const PRESERVED = ["INOD", "005930.KS", "105560.KS"] as const;

function stubSnap(company: Company): Snapshot {
  return {
    id: `snap_${company.ticker}`,
    companyId: company.id,
    asOf: "2026-09-04",
    createdAt: "2026-09-04T00:00:00.000Z",
    tags: ["RESEARCH REQUIRED"],
    overallCoverage: 0.4,
    xbagger: { status: "PARTIAL", version: "XBG-v2.0" },
    oversold: { status: "PARTIAL", version: "OSM-v2.1" },
    quality: { status: "PARTIAL", version: "MFC70-v1.2" },
  } as Snapshot;
}

function companyOf(ticker: string, id = `c_${ticker}`): Company {
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

function draftFor(ticker: string): ResearchDraft {
  const fin = {
    ...emptyFinancials(),
    revenueTtm: 100,
    revenuePrior: 80,
    operatingIncomeTtm: 12,
    netIncomeTtm: 8,
    grossMargin: 0.6,
    operatingMargin: 0.12,
    fcf: 6,
    cfo: 7,
    cash: 40,
    totalDebt: 5,
    sharesOutstanding: 10,
  };
  const scenarios = defaultScenarios(1e9, fin);
  return {
    quote: {
      ticker,
      exchange: "NASDAQ",
      companyName: ticker,
      currency: "USD",
      price: 10,
      marketCap: 1e9,
      enterpriseValue: 9.6e8,
      country: "US",
      sector: "Technology",
      industry: "Software",
      financials: fin,
    },
    factors: FACTOR_ORDER.map((c) => ({
      code: c,
      score: 6,
      summary: `fixture-${c}`,
      confidence: "Medium" as const,
    })),
    redFlags: [],
    tenxScenarios: [scenarios.bear, scenarios.base, scenarios.bull],
    requiredRevenue: null,
    requiredNetIncome: null,
    requiredPe: null,
    requiredEvSales: null,
    tenxFeasibility: "POSSIBLE",
    catalysts: ["c"],
    risks: ["r"],
    nextProof: ["p"],
    killCriteria: ["k"],
    thesis: "fixture thesis",
    evidences: [],
    findings: [],
    researchProvider: "test-fixture",
  };
}

function emptyDump(companies: Company[] = [], snapshots: Snapshot[] = []) {
  return {
    companies,
    snapshots,
    universes: [],
    watchlist: [] as string[],
    audit: [],
    settings: null,
  };
}

async function retireSample100Runs(): Promise<void> {
  const sql = await getSql();
  if (!(await queueTablesReady(sql))) return;
  await sql.query(
    `update research_runs
     set status = 'CANCELLED', completed_at = coalesce(completed_at, $1)
     where type = 'INITIAL_BATCH' and universe_id = $2 and status in ('RUNNING','QUEUED','PAUSED')`,
    [new Date().toISOString(), SAMPLE_RESEARCH_100_UNIVERSE_ID],
  );
}

async function startIsolated(remaining: Array<{ ticker: string; companyId: string }>, companies: Company[], snapshots: Snapshot[]) {
  await retireSample100Runs();
  __resetRunnerControl();
  return startFull100FromWorkspace({
    executeEnabled: true,
    remaining,
    loadWorkspace: async () => emptyDump(companies, snapshots),
    providerProbe: async () => ({ us: true, kr: true }),
  });
}

describe("production Full100 start wiring", () => {
  it("keeps EXECUTE_FULL_100 off", () => {
    assert.equal(EXECUTE_FULL_100, false);
  });

  it("flag off creates 0 jobs and does not load workspace", async () => {
    let loaded = false;
    const before = (await listResearchRuns()).length;
    const res = await startFull100FromWorkspace({
      loadWorkspace: async () => {
        loaded = true;
        return emptyDump(SAMPLE_RESEARCH_100, []);
      },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error, FULL100_EXECUTION_DISABLED);
    assert.equal(loaded, false);
    assert.equal((await listResearchRuns()).length, before);
  });

  it("startFull100FromWorkspace with Sample100 + 3 analyses creates 97 jobs and skips preserved tickers", async () => {
    const companies = SAMPLE_RESEARCH_100;
    const snapshots = companies.filter((c) => (PRESERVED as readonly string[]).includes(c.ticker)).map(stubSnap);
    const remaining = remainingUniverseJobs(companies, snapshots);
    assert.equal(SAMPLE_RESEARCH_100.length, 100);
    assert.equal(snapshots.length, 3);
    assert.equal(remaining.length, 97);
    assert.ok(!remaining.some((j) => (PRESERVED as readonly string[]).includes(j.ticker)));

    await retireSample100Runs();
    const res = await startFull100FromWorkspace({
      executeEnabled: true,
      loadWorkspace: async () => emptyDump(companies, snapshots),
      providerProbe: async () => ({ us: true, kr: true }),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.totalJobs, 97);
    const jobs = await listJobsForRun(res.runId);
    assert.equal(jobs.length, 97);
    assert.ok(!jobs.some((j) => j.ticker === "INOD"));
    assert.ok(!jobs.some((j) => j.ticker === "005930.KS"));
    assert.ok(!jobs.some((j) => j.ticker === "105560.KS"));
    await cancelResearchRun(res.runId);
  });

  it("second INITIAL_BATCH for Sample100 is rejected", async () => {
    await retireSample100Runs();
    const first = await startFull100FromWorkspace({
      executeEnabled: true,
      remaining: [{ ticker: "CONFLICT1", companyId: "c_conflict1" }],
      loadWorkspace: async () => emptyDump(),
      providerProbe: async () => ({ us: true, kr: true }),
    });
    assert.equal(first.ok, true);
    const second = await startFull100FromWorkspace({
      executeEnabled: true,
      remaining: [{ ticker: "CONFLICT2", companyId: "c_conflict2" }],
      loadWorkspace: async () => emptyDump(),
      providerProbe: async () => ({ us: true, kr: true }),
    });
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.error, "ACTIVE_FULL100_RUN");
    if (first.ok) await cancelResearchRun(first.runId);
  });
});

describe("isolated 5-identity dry-run", () => {
  it("2 analyzed / 3 remaining → chunk persist, restart, resume, complete once", async () => {
    const stamp = `ISO${Date.now().toString(36)}`;
    const tickers = ["A", "B", "C", "D", "E"].map((s) => `${stamp}${s}`);
    const companies = tickers.map((t) => companyOf(t));
    const snapshots = [stubSnap(companies[0]!), stubSnap(companies[1]!)];
    const remaining = companies.slice(2).map((c) => ({ ticker: c.ticker, companyId: c.id }));
    assert.equal(remaining.length, 3);

    const researched: string[] = [];
    const persistTickers: string[] = [];
    const snapIds = new Set<string>();
    const deps = createProductionDeps({
      useAi: false,
      loadWorkspace: async () => emptyDump(companies, snapshots),
      executeResearch: async ({ ticker }) => {
        researched.push(ticker);
        return { ok: true, draft: draftFor(ticker) };
      },
      saveAnalysisTransaction: async (input) => {
        persistTickers.push(input.company.ticker);
        snapIds.add(input.snapshot.id);
        await saveAnalysisTransaction(input);
      },
    });

    const started = await startIsolated(remaining, companies, snapshots);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    assert.equal(started.totalJobs, 3);

    const chunk1 = await processFull100Chunk(started.runId, {
      executeEnabled: true,
      deps,
      chunkSize: 1,
    });
    assert.equal(chunk1.ok, true);
    assert.equal(chunk1.processed.length, 1);
    assert.equal(chunk1.run?.status, "RUNNING");
    assert.equal(chunk1.run?.completedJobs, 1);

    __resetRunnerControl();
    const afterRestart = await processFull100Chunk(started.runId, {
      executeEnabled: true,
      deps,
      chunkSize: 1,
    });
    assert.equal(afterRestart.processed.length, 1);
    assert.equal(afterRestart.run?.completedJobs, 2);

    const last = await processFull100Chunk(started.runId, {
      executeEnabled: true,
      deps,
      chunkSize: 1,
    });
    assert.equal(last.processed.length, 1);
    assert.equal(last.run?.status, "COMPLETE");
    assert.ok(last.run?.completedAt);
    assert.equal(last.run?.completedJobs, 3);
    assert.equal(last.run?.failedJobs, 0);
    assert.equal(researched.length, 3);
    assert.equal(persistTickers.length, 3);
    assert.equal(snapIds.size, 3);
    assert.deepEqual([...new Set(persistTickers)].sort(), remaining.map((r) => r.ticker).sort());

    const idle = await processFull100Chunk(started.runId, { executeEnabled: true, deps, chunkSize: 1 });
    assert.equal(idle.processed.length, 0);
    assert.equal(idle.skipped, "COMPLETE");
    assert.equal(researched.length, 3);

    const sql = await getSql();
    const analyses = await sql.query<{ id: string }>(
      "select id from analyses where company_id = any($1::text[])",
      [remaining.map((r) => r.companyId)],
    );
    assert.equal(analyses.length, 3);
  });

  it("production deps actually call executeResearch and saveAnalysisTransaction", async () => {
    const stamp = `WIR${Date.now().toString(36)}`;
    const ticker = `${stamp}X`;
    const company = companyOf(ticker);
    const researchCalls: string[] = [];
    const persistCalls: string[] = [];
    const deps = createProductionDeps({
      useAi: false,
      loadWorkspace: async () => emptyDump([company], []),
      executeResearch: async (input) => {
        researchCalls.push(input.ticker);
        return { ok: true, draft: draftFor(input.ticker) };
      },
      saveAnalysisTransaction: async (input) => {
        persistCalls.push(input.company.ticker);
        if (input.job) await updateResearchJob(input.job.id, input.job.patch);
      },
    });
    const started = await startIsolated([{ ticker, companyId: company.id }], [company], []);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const chunk = await processFull100Chunk(started.runId, { executeEnabled: true, deps, chunkSize: 1 });
    assert.equal(chunk.ok, true);
    assert.deepEqual(researchCalls, [ticker]);
    assert.deepEqual(persistCalls, [ticker]);
    assert.notEqual(chunk.run?.status, "RUNNING");
    assert.equal(chunk.run?.status, "COMPLETE");
    await cancelResearchRun(started.runId);
  });

  it("persist failure does not mark the job COMPLETE", async () => {
    const stamp = `PF${Date.now().toString(36)}`;
    const ticker = `${stamp}Z`;
    const company = companyOf(ticker);
    const deps = createProductionDeps({
      useAi: false,
      loadWorkspace: async () => emptyDump([company], []),
      executeResearch: async ({ ticker: t }) => ({ ok: true, draft: draftFor(t) }),
      saveAnalysisTransaction: async () => {
        throw new Error("forced persist failure");
      },
    });
    const started = await startIsolated([{ ticker, companyId: company.id }], [company], []);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const chunk = await processFull100Chunk(started.runId, {
      executeEnabled: true,
      deps: { ...deps, sleep: async () => undefined, maxAttempts: 2 },
      chunkSize: 1,
    });
    const job = (await listJobsForRun(started.runId))[0];
    assert.ok(job);
    assert.notEqual(job.status, "COMPLETE");
    assert.equal(job.status, "FAILED");
    assert.equal(job.failureClass, "DATABASE_FAILURE");
    assert.equal(chunk.run?.failedJobs, 1);
    assert.equal(chunk.run?.status, "COMPLETE");
    await cancelResearchRun(started.runId);
  });
});

describe("chunk pause / cancel / DB-authoritative status", () => {
  it("paused DB status blocks the next chunk after process restart", async () => {
    const stamp = `PAU${Date.now().toString(36)}`;
    const remaining = [0, 1, 2, 3].map((i) => {
      const ticker = `${stamp}${i}`;
      return { ticker, companyId: `c_${ticker}` };
    });
    const companies = remaining.map((r) => companyOf(r.ticker, r.companyId));
    const researched: string[] = [];
    const deps = createProductionDeps({
      useAi: false,
      loadWorkspace: async () => emptyDump(companies, []),
      executeResearch: async ({ ticker }) => {
        researched.push(ticker);
        return { ok: true, draft: draftFor(ticker) };
      },
      saveAnalysisTransaction: async (input) => {
        if (input.job) await updateResearchJob(input.job.id, input.job.patch);
      },
    });
    const started = await startIsolated(remaining, companies, []);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    await processFull100Chunk(started.runId, { executeEnabled: true, deps, chunkSize: 2 });
    assert.equal(researched.length, 2);
    await pauseResearchRun(started.runId);
    __resetRunnerControl();
    const blocked = await processFull100Chunk(started.runId, { executeEnabled: true, deps, chunkSize: 2 });
    assert.equal(blocked.processed.length, 0);
    assert.equal(blocked.skipped, "PAUSED");
    assert.equal(researched.length, 2);
    await resumeResearchRun(started.runId);
    const resumed = await processFull100Chunk(started.runId, { executeEnabled: true, deps, chunkSize: 2 });
    assert.equal(resumed.processed.length, 2);
    assert.equal(researched.length, 4);
    await cancelResearchRun(started.runId);
  });

  it("cancelled DB status blocks further jobs and keeps completed analyses", async () => {
    const stamp = `CAN${Date.now().toString(36)}`;
    const remaining = [0, 1, 2, 3].map((i) => {
      const ticker = `${stamp}${i}`;
      return { ticker, companyId: `c_${ticker}` };
    });
    const companies = remaining.map((r) => companyOf(r.ticker, r.companyId));
    const researched: string[] = [];
    const deps = createProductionDeps({
      useAi: false,
      loadWorkspace: async () => emptyDump(companies, []),
      executeResearch: async ({ ticker }) => {
        researched.push(ticker);
        return { ok: true, draft: draftFor(ticker) };
      },
      saveAnalysisTransaction: async (input) => {
        if (input.job) await updateResearchJob(input.job.id, input.job.patch);
      },
    });
    const started = await startIsolated(remaining, companies, []);
    assert.equal(started.ok, true);
    if (!started.ok) return;
    await processFull100Chunk(started.runId, { executeEnabled: true, deps, chunkSize: 2 });
    const doneBefore = researched.slice();
    await cancelResearchRun(started.runId);
    __resetRunnerControl();
    const blocked = await processFull100Chunk(started.runId, { executeEnabled: true, deps, chunkSize: 2 });
    assert.equal(blocked.processed.length, 0);
    assert.equal(blocked.skipped, "CANCELLED");
    assert.deepEqual(researched, doneBefore);
    const jobs = await listJobsForRun(started.runId);
    const completed = jobs.filter((j) => j.status === "COMPLETE" || j.status === "PARTIAL" || j.status === "RESEARCH_REQUIRED");
    assert.equal(completed.length, 2);
  });

  it("flag-off chunk processor does not research", async () => {
    const researched: string[] = [];
    const chunk = await processFull100Chunk("missing", {
      deps: createProductionDeps({
        executeResearch: async ({ ticker }) => {
          researched.push(ticker);
          return { ok: false, error: "nope" };
        },
      }),
    });
    assert.equal(chunk.ok, false);
    assert.equal(chunk.skipped, FULL100_EXECUTION_DISABLED);
    assert.equal(researched.length, 0);
  });
});
