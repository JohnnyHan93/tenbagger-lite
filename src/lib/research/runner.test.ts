import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import type { ResearchJobRow } from "../persist/queue.ts";
import {
  FULL100_EXECUTION_DISABLED,
  __resetRunnerControl,
  processJobWithRetry,
  processRun,
  startFull100Research,
  type JobStore,
  type ResearchOutcome,
  type RunnerDeps,
} from "./runner.ts";
import { EXECUTE_FULL_100 } from "./jobs.ts";

function company(ticker: string): Company {
  return {
    id: `c_${ticker}`,
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

function snapshot(ticker: string, coverage = 0.4): Snapshot {
  return {
    id: `snap_${ticker}`,
    companyId: `c_${ticker}`,
    asOf: "2026-09-04",
    createdAt: "2026-09-04T00:00:00.000Z",
    tags: coverage < 0.7 ? ["RESEARCH REQUIRED"] : [],
    overallCoverage: coverage,
    xbagger: { status: "PARTIAL", version: "XBG-v2.0" },
    oversold: { status: "PARTIAL", version: "OSM-v2.1" },
    quality: { status: "PARTIAL", version: "MFC70-v1.2" },
  } as Snapshot;
}

function jobRow(partial: Partial<ResearchJobRow> & Pick<ResearchJobRow, "id" | "ticker" | "runId" | "status">): ResearchJobRow {
  const now = "2026-09-04T00:00:00.000Z";
  return {
    universeId: "u_test",
    companyId: `c_${partial.ticker}`,
    attemptCount: 0,
    failureClass: null,
    provider: null,
    lastError: null,
    createdAt: now,
    queuedAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
    payload: { attempts: [] },
    ...partial,
  };
}

function memoryJobs(rows: ResearchJobRow[]): JobStore & { map: Map<string, ResearchJobRow> } {
  const map = new Map(rows.map((r) => [r.id, { ...r, payload: { ...r.payload } }]));
  return {
    map,
    async get(id) {
      const row = map.get(id);
      return row ? { ...row, payload: { ...row.payload } } : null;
    },
    async update(id, patch) {
      const cur = map.get(id);
      if (!cur) throw new Error(`missing job ${id}`);
      map.set(id, { ...cur, ...patch, payload: patch.payload ?? cur.payload, updatedAt: new Date().toISOString() });
    },
    async list(runId) {
      return [...map.values()].filter((j) => j.runId === runId).map((j) => ({ ...j }));
    },
  };
}

describe("Full 100 execution flag", () => {
  it("rejects start when EXECUTE_FULL_100 is false", async () => {
    assert.equal(EXECUTE_FULL_100, false);
    const researched: string[] = [];
    const res = await startFull100Research({
      companies: [],
      snapshots: [],
      deps: {
        research: async (ticker) => {
          researched.push(ticker);
          return { ok: false, failureClass: "UNKNOWN", error: "should not run" };
        },
        persist: async () => {
          throw new Error("should not persist");
        },
      },
    });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error, FULL100_EXECUTION_DISABLED);
    assert.equal(researched.length, 0);
  });
});

describe("retry / persist once", () => {
  it("retries 429 then timeout then succeeds with one snapshot", async () => {
    __resetRunnerControl();
    const store = memoryJobs([jobRow({ id: "j1", ticker: "INOD", runId: "r1", status: "QUEUED" })]);
    const calls: string[] = [];
    let persistCount = 0;
    const snapIds = new Set<string>();
    const seq: Array<"429" | "timeout" | "ok"> = ["429", "timeout", "ok"];
    const deps: RunnerDeps = {
      jobs: store,
      sleep: async () => undefined,
      research: async (ticker) => {
        const step = seq.shift();
        calls.push(`${ticker}:${step}`);
        if (step === "429") return { ok: false, failureClass: "RATE_LIMITED", error: "429 rate limit" };
        if (step === "timeout") return { ok: false, failureClass: "TIMEOUT", error: "timeout" };
        return { ok: true, company: company(ticker), snapshot: snapshot(ticker) };
      },
      persist: async (_c, snap) => {
        persistCount += 1;
        snapIds.add(snap.id);
      },
    };
    const done = await processJobWithRetry(store.map.get("j1")!, deps);
    assert.equal(done.attemptCount, 3);
    assert.equal(done.status, "RESEARCH_REQUIRED");
    assert.equal(persistCount, 1);
    assert.equal(snapIds.size, 1);
    assert.deepEqual(calls, ["INOD:429", "INOD:timeout", "INOD:ok"]);
  });

  it("non-retryable identity failure stops immediately", async () => {
    const store = memoryJobs([jobRow({ id: "j2", ticker: "NOPE", runId: "r1", status: "QUEUED" })]);
    let researchCalls = 0;
    const done = await processJobWithRetry(store.map.get("j2")!, {
      jobs: store,
      sleep: async () => undefined,
      research: async () => {
        researchCalls += 1;
        return { ok: false, failureClass: "IDENTITY_FAILURE", error: "invalid ticker" };
      },
      persist: async () => {
        throw new Error("must not persist");
      },
    });
    assert.equal(researchCalls, 1);
    assert.equal(done.status, "FAILED");
    assert.equal(done.failureClass, "IDENTITY_FAILURE");
    assert.equal(done.attemptCount, 1);
  });

  it("persist failure does not mark COMPLETE and can retry same snapshot", async () => {
    const store = memoryJobs([jobRow({ id: "j3", ticker: "MSFT", runId: "r1", status: "QUEUED" })]);
    let persistTries = 0;
    let researchCalls = 0;
    const done = await processJobWithRetry(store.map.get("j3")!, {
      jobs: store,
      sleep: async () => undefined,
      maxAttempts: 3,
      research: async (ticker) => {
        researchCalls += 1;
        return { ok: true, company: company(ticker), snapshot: snapshot(ticker) };
      },
      persist: async () => {
        persistTries += 1;
        if (persistTries < 2) throw new Error("db down");
      },
    });
    assert.equal(researchCalls, 1);
    assert.equal(persistTries, 2);
    assert.equal(done.status, "RESEARCH_REQUIRED");
  });

  it("persist exhaustion leaves job FAILED DATABASE_FAILURE", async () => {
    const store = memoryJobs([jobRow({ id: "j4", ticker: "NVDA", runId: "r1", status: "QUEUED" })]);
    const done = await processJobWithRetry(store.map.get("j4")!, {
      jobs: store,
      sleep: async () => undefined,
      maxAttempts: 2,
      research: async (ticker): Promise<ResearchOutcome> => ({
        ok: true,
        company: company(ticker),
        snapshot: snapshot(ticker),
      }),
      persist: async () => {
        throw new Error("sql write failed");
      },
    });
    assert.equal(done.status, "FAILED");
    assert.equal(done.failureClass, "DATABASE_FAILURE");
    assert.notEqual(done.status, "COMPLETE");
  });
});

describe("resume does not re-run completed jobs", () => {
  it("10 jobs / 4 complete → only 6 execute", async () => {
    __resetRunnerControl();
    const rows: ResearchJobRow[] = [];
    for (let i = 0; i < 10; i += 1) {
      const ticker = `T${i}`;
      rows.push(
        jobRow({
          id: `j_${i}`,
          ticker,
          runId: "r_resume",
          status: i < 4 ? "COMPLETE" : "QUEUED",
        }),
      );
    }
    const store = memoryJobs(rows);
    const researched: string[] = [];
    const { processed } = await processRun("r_resume", {
      jobs: store,
      concurrency: 3,
      sleep: async () => undefined,
      research: async (ticker) => {
        researched.push(ticker);
        return { ok: true, company: company(ticker), snapshot: snapshot(ticker) };
      },
      persist: async () => undefined,
    });
    assert.equal(researched.length, 6);
    assert.equal(processed.length, 6);
    assert.ok(!researched.includes("T0"));
    assert.ok(!researched.includes("T3"));
    assert.ok(researched.includes("T4"));
  });
});

describe("bounded chunks", () => {
  it("one chunk processes at most 3 of 10 pending jobs", async () => {
    __resetRunnerControl();
    const rows = Array.from({ length: 10 }, (_, i) =>
      jobRow({ id: `c_${i}`, ticker: `C${i}`, runId: "r_chunk", status: "QUEUED" }),
    );
    const store = memoryJobs(rows);
    const researched: string[] = [];
    const { processed } = await processRun(
      "r_chunk",
      {
        jobs: store,
        concurrency: 3,
        sleep: async () => undefined,
        research: async (ticker) => {
          researched.push(ticker);
          return { ok: true, company: company(ticker), snapshot: snapshot(ticker) };
        },
        persist: async () => undefined,
      },
      { maxJobs: 3 },
    );
    assert.equal(processed.length, 3);
    assert.equal(researched.length, 3);
    const stillQueued = [...store.map.values()].filter((j) => j.status === "QUEUED");
    assert.equal(stillQueued.length, 7);
  });

  it("paused run does not schedule the next chunk", async () => {
    __resetRunnerControl();
    const { pauseResearchRun } = await import("./runner.ts");
    const rows = Array.from({ length: 6 }, (_, i) =>
      jobRow({ id: `p_${i}`, ticker: `P${i}`, runId: "r_pause", status: "QUEUED" }),
    );
    const store = memoryJobs(rows);
    const researched: string[] = [];
    const deps = {
      jobs: store,
      concurrency: 3,
      sleep: async () => undefined,
      research: async (ticker: string) => {
        researched.push(ticker);
        return { ok: true as const, company: company(ticker), snapshot: snapshot(ticker) };
      },
      persist: async () => undefined,
    };
    await processRun("r_pause", deps, { maxJobs: 3 });
    assert.equal(researched.length, 3);
    await pauseResearchRun("r_pause");
    const second = await processRun("r_pause", deps, { maxJobs: 3 });
    assert.equal(second.processed.length, 0);
    assert.equal(researched.length, 3);
  });

  it("cancelled run does not execute further jobs", async () => {
    __resetRunnerControl();
    const { cancelResearchRun } = await import("./runner.ts");
    const rows = Array.from({ length: 6 }, (_, i) =>
      jobRow({ id: `k_${i}`, ticker: `K${i}`, runId: "r_cancel", status: "QUEUED" }),
    );
    const store = memoryJobs(rows);
    const researched: string[] = [];
    const deps = {
      jobs: store,
      concurrency: 3,
      sleep: async () => undefined,
      research: async (ticker: string) => {
        researched.push(ticker);
        return { ok: true as const, company: company(ticker), snapshot: snapshot(ticker) };
      },
      persist: async () => undefined,
    };
    await processRun("r_cancel", deps, { maxJobs: 3 });
    await cancelResearchRun("r_cancel", store);
    const second = await processRun("r_cancel", deps, { maxJobs: 3 });
    assert.equal(second.processed.length, 0);
    assert.equal(researched.length, 3);
  });

  it("persistFinalizesJob skips a second status write", async () => {
    const store = memoryJobs([jobRow({ id: "j_fin", ticker: "FIN", runId: "r1", status: "QUEUED" })]);
    let extraStatusWrites = 0;
    const origUpdate = store.update.bind(store);
    store.update = async (id, patch) => {
      if (patch.status === "RESEARCH_REQUIRED" || patch.status === "COMPLETE" || patch.status === "PARTIAL") {
        extraStatusWrites += 1;
      }
      return origUpdate(id, patch);
    };
    const done = await processJobWithRetry(store.map.get("j_fin")!, {
      jobs: store,
      persistFinalizesJob: true,
      sleep: async () => undefined,
      research: async (ticker) => ({ ok: true, company: company(ticker), snapshot: snapshot(ticker) }),
      persist: async (_c, _s, job, status) => {
        await origUpdate(job.id, { status, completedAt: "2026-09-04T00:00:01.000Z" });
      },
    });
    assert.equal(done.status, "RESEARCH_REQUIRED");
    assert.equal(extraStatusWrites, 0);
  });
});
