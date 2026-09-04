import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSql } from "../db.ts";
import {
  getResearchJob,
  insertResearchJob,
  insertResearchRun,
  listJobsForRun,
  queueTablesReady,
  recoverStaleJobs,
  summarizeJobCounts,
  syncRunProgress,
  updateResearchJob,
  type ResearchJobRow,
  type ResearchRunRow,
} from "./queue.ts";

function run(id: string): ResearchRunRow {
  return {
    id,
    universeId: "u_test",
    type: "INITIAL_BATCH",
    status: "RUNNING",
    totalJobs: 3,
    completedJobs: 1,
    failedJobs: 0,
    startedAt: "2026-09-04T00:00:00.000Z",
    completedAt: null,
    createdAt: "2026-09-04T00:00:00.000Z",
    modelVersions: {},
    payload: { test: true },
  };
}

function job(partial: Partial<ResearchJobRow> & Pick<ResearchJobRow, "id" | "ticker" | "runId" | "status">): ResearchJobRow {
  const now = "2026-09-04T00:00:00.000Z";
  return {
    universeId: "u_test",
    companyId: partial.ticker,
    attemptCount: 0,
    failureClass: null,
    provider: null,
    lastError: null,
    createdAt: now,
    queuedAt: now,
    startedAt: partial.status === "RESEARCHING" ? now : null,
    completedAt: partial.status === "COMPLETE" ? now : null,
    updatedAt: now,
    payload: { test: true },
    ...partial,
  };
}

describe("persistent research jobs", () => {
  it("queue tables exist after migration", async () => {
    await getSql();
    assert.equal(await queueTablesReady(), true);
  });

  it("retains COMPLETE, recovers RESEARCHING, keeps QUEUED across recover", async () => {
    const sql = await getSql();
    const runId = `run_q_${Date.now()}`;
    await insertResearchRun(run(runId), sql);
    await insertResearchJob(job({ id: `${runId}_a`, ticker: "AAA", runId, status: "COMPLETE" }), sql);
    await insertResearchJob(job({ id: `${runId}_b`, ticker: "BBB", runId, status: "RESEARCHING", attemptCount: 1 }), sql);
    await insertResearchJob(job({ id: `${runId}_c`, ticker: "CCC", runId, status: "QUEUED" }), sql);

    const recovered = await recoverStaleJobs(runId, sql);
    assert.equal(recovered, 1);
    const a = await getResearchJob(`${runId}_a`, sql);
    const b = await getResearchJob(`${runId}_b`, sql);
    const c = await getResearchJob(`${runId}_c`, sql);
    assert.equal(a?.status, "COMPLETE");
    assert.equal(b?.status, "QUEUED");
    assert.equal(c?.status, "QUEUED");
    const listed = await listJobsForRun(runId, sql);
    assert.equal(listed.length, 3);
  });
});

describe("run progress counters", () => {
  it("COMPLETE+PARTIAL+RESEARCH_REQUIRED = completed_jobs; remaining 2 → COMPLETE", async () => {
    const sql = await getSql();
    const runId = `run_sync_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await insertResearchRun(
      {
        ...run(runId),
        totalJobs: 10,
        completedJobs: 0,
        failedJobs: 0,
        status: "RUNNING",
      },
      sql,
    );
    const statuses: ResearchJobRow["status"][] = [
      "COMPLETE",
      "COMPLETE",
      "COMPLETE",
      "PARTIAL",
      "PARTIAL",
      "RESEARCH_REQUIRED",
      "RESEARCH_REQUIRED",
      "FAILED",
      "QUEUED",
      "QUEUED",
    ];
    for (let i = 0; i < statuses.length; i += 1) {
      await insertResearchJob(
        job({
          id: `${runId}_${i}`,
          ticker: `S${i}`,
          runId,
          status: statuses[i]!,
          completedAt: statuses[i] === "QUEUED" ? null : "2026-09-04T00:00:00.000Z",
        }),
        sql,
      );
    }
    const mid = await syncRunProgress(runId, sql);
    assert.equal(mid.completedJobs, 7);
    assert.equal(mid.failedJobs, 1);
    assert.equal(mid.status, "RUNNING");
    assert.equal(mid.completedAt, null);
    const counts = summarizeJobCounts(await listJobsForRun(runId, sql));
    assert.equal(counts.successful, 7);
    assert.equal(counts.failed, 1);
    assert.equal(counts.queued, 2);
    assert.equal(counts.terminal, 8);

    await updateResearchJob(`${runId}_8`, { status: "COMPLETE", completedAt: "2026-09-04T00:01:00.000Z" }, sql);
    await updateResearchJob(`${runId}_9`, { status: "PARTIAL", completedAt: "2026-09-04T00:01:00.000Z" }, sql);
    const done = await syncRunProgress(runId, sql);
    assert.equal(done.completedJobs, 9);
    assert.equal(done.failedJobs, 1);
    assert.equal(done.status, "COMPLETE");
    assert.ok(done.completedAt);
  });
});
