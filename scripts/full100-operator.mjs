import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:8080";
const OUT_DIR = "/workspace/data";
const PROGRESS = path.join(OUT_DIR, "full100-progress.json");
const BASELINE = path.join(OUT_DIR, "full100-baseline.json");
const PRESERVED = ["INOD", "005930.KS", "105560.KS"];
const CHUNK_TIMEOUT_MS = 240_000;

fs.mkdirSync(OUT_DIR, { recursive: true });

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function log(msg, extra) {
  const line = `[full100] ${new Date().toISOString()} ${msg}`;
  console.log(line);
  if (extra) console.log(JSON.stringify(extra));
}

async function waitOperator(page) {
  await page.goto(`${BASE}/queue?operator=v24`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__idtOperator), { timeout: 60_000 });
}

async function call(page, fn, arg) {
  return page.evaluate(
    async ({ fn, arg }) => {
      const op = window.__idtOperator;
      if (!op) throw new Error("operator missing");
      if (fn === "chunk" || fn === "pause" || fn === "resume") return op[fn](arg);
      return op[fn]();
    },
    { fn, arg },
  );
}

function jobTouchesPreserved(ticker) {
  const bare = String(ticker).replace(/\.(KS|KQ)$/i, "").toUpperCase();
  return PRESERVED.some((p) => p.replace(/\.(KS|KQ)$/i, "").toUpperCase() === bare || p.toUpperCase() === String(ticker).toUpperCase());
}

function summarizeJobs(jobs) {
  const counts = {};
  for (const j of jobs ?? []) counts[j.status] = (counts[j.status] ?? 0) + 1;
  return counts;
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(CHUNK_TIMEOUT_MS);

await waitOperator(page);

const baseline = await call(page, "dump");
writeJson(BASELINE, baseline);
log("PRE-RUN SNAPSHOT", {
  sample100: baseline.universe.sample100,
  us: baseline.universe.us,
  kr: baseline.universe.kr,
  analyzed: baseline.universe.analyzed,
  remaining: baseline.universe.remaining,
  extraSmoke: baseline.universe.extraSmoke,
  fakeDemo: baseline.universe.fakeDemo,
  preserved: baseline.preserved,
  counts: baseline.counts,
  hasXai: baseline.hasXai,
});

if (baseline.universe.sample100 !== 100 || baseline.universe.us !== 50 || baseline.universe.kr !== 50) {
  log("STOP universe mismatch");
  await browser.close();
  process.exit(2);
}
if (baseline.universe.fakeDemo !== 0) {
  log("STOP fake demo present");
  await browser.close();
  process.exit(2);
}
if (baseline.universe.analyzed !== 3 || baseline.universe.remaining !== 97) {
  log("STOP unexpected analyzed/remaining — will not start Full100", baseline.universe);
  await browser.close();
  process.exit(2);
}
if (!baseline.preserved.INOD || !baseline.preserved["005930.KS"] || !baseline.preserved["105560.KS"]) {
  log("STOP existing 3 not preserved", baseline.preserved);
  await browser.close();
  process.exit(2);
}
if (baseline.universe.extraSmoke < 9) {
  log("WARN smoke extra lower than 9", { extraSmoke: baseline.universe.extraSmoke });
}

const preflight = await call(page, "preflight");
const liveFails = (preflight.checks ?? []).filter((c) => c.kind === "LIVE" && !c.pass && c.id !== "flag");
log("PREFLIGHT", {
  ready: preflight.ready,
  executorReady: preflight.executorReady,
  providerConfig: preflight.providerConfig,
  executeFull100: preflight.executeFull100,
  liveFails: liveFails.map((c) => c.id),
});
if (!preflight.executorReady || !preflight.providerConfig) {
  log("PREFLIGHT_FAILED", liveFails);
  writeJson(path.join(OUT_DIR, "full100-preflight-failed.json"), preflight);
  await browser.close();
  process.exit(3);
}

let started = await call(page, "start");
log("START", started);
if (!started?.ok) {
  log("START FAILED", started);
  await browser.close();
  process.exit(4);
}

const afterStart = await call(page, "dump");
const createdJobs = afterStart.jobs ?? [];
log("JOB COUNT", { total: createdJobs.length, run: afterStart.run, resumed: started.resumed ?? false });
if (!started.resumed && createdJobs.length !== 97) {
  log("STOP unexpected job count", { n: createdJobs.length });
  await call(page, "pause", started.runId);
  await browser.close();
  process.exit(5);
}
const preservedHit = createdJobs.filter((j) => jobTouchesPreserved(j.ticker));
if (preservedHit.length) {
  log("STOP jobs include preserved tickers", preservedHit);
  await browser.close();
  process.exit(5);
}

const runId = started.runId;
const t0 = Date.now();
let consecutiveSystemic = [];
let processedTotal = 0;
const progressLog = [];

while (true) {
  let chunk;
  try {
    chunk = await call(page, "chunk", runId);
  } catch (err) {
    log("CHUNK ERROR", { error: String(err) });
    await waitOperator(page);
    continue;
  }
  const dump = await call(page, "dump");
  const counts = dump.jobCounts ?? summarizeJobs(dump.jobs);
  const terminal =
    (counts.COMPLETE ?? 0) +
    (counts.PARTIAL ?? 0) +
    (counts.RESEARCH_REQUIRED ?? 0) +
    (counts.FAILED ?? 0) +
    (counts.CANCELLED ?? 0);
  processedTotal = terminal;
  const remaining = (dump.run?.totalJobs ?? 97) - terminal;
  const rec = {
    at: new Date().toISOString(),
    processed: chunk.processed ?? [],
    skipped: chunk.skipped ?? null,
    run: dump.run,
    counts,
    remaining,
    ms: Date.now() - t0,
  };
  progressLog.push(rec);
  writeJson(PROGRESS, { runId, startedAt: new Date(t0).toISOString(), chunks: progressLog, latest: rec });
  log("CHUNK", rec);

  if (processedTotal > 0 && processedTotal % 10 < 3) {
    log("FULL100 PROGRESS", {
      Processed: `${processedTotal} / ${dump.run?.totalJobs ?? 97}`,
      COMPLETE: counts.COMPLETE ?? 0,
      PARTIAL: counts.PARTIAL ?? 0,
      RESEARCH_REQUIRED: counts.RESEARCH_REQUIRED ?? 0,
      FAILED: counts.FAILED ?? 0,
      Remaining: remaining,
    });
    try {
      await call(page, "checkpoint");
    } catch (err) {
      log("checkpoint failed", { error: String(err) });
    }
  }

  const failedJobs = (dump.jobs ?? []).filter((j) => j.status === "FAILED");
  const lastFailed = failedJobs.slice(-3);
  if (chunk.processed?.length) {
    const justFailed = (dump.jobs ?? []).filter(
      (j) => chunk.processed.includes(j.ticker) && j.status === "FAILED",
    );
    for (const j of justFailed) {
      consecutiveSystemic.push(j.failureClass || "UNKNOWN");
    }
    if (justFailed.length === 0 && (chunk.processed?.length ?? 0) > 0) {
      consecutiveSystemic = [];
    }
    if (consecutiveSystemic.length >= 3) {
      const same = consecutiveSystemic.slice(-3);
      if (same[0] && same[0] === same[1] && same[1] === same[2] && same[0] !== "IDENTITY_FAILURE") {
        log("SYSTEMIC PAUSE", { failureClass: same[0], lastFailed });
        await call(page, "pause", runId);
        writeJson(path.join(OUT_DIR, "full100-paused.json"), { reason: same[0], dump });
        break;
      }
    }
  }

  if (chunk.skipped && ["PAUSED", "CANCELLED", "COMPLETE", "FAILED"].includes(chunk.skipped)) {
    log("RUN TERMINAL", chunk.skipped);
    break;
  }
  if (dump.run?.status && ["COMPLETE", "CANCELLED", "FAILED", "PAUSED"].includes(dump.run.status)) {
    log("RUN STATUS", dump.run.status);
    break;
  }
  if (!chunk.ok) {
    log("CHUNK NOT OK", chunk);
    await new Promise((r) => setTimeout(r, 2000));
  }
  if ((chunk.processed?.length ?? 0) === 0 && remaining === 0) break;
  if ((chunk.processed?.length ?? 0) === 0 && remaining > 0 && dump.run?.status === "RUNNING") {
    log("idle chunk with remaining — retry after recover");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

try {
  await call(page, "checkpoint");
} catch {
  /* optional */
}

const finalDump = await call(page, "dump");
const report = await call(page, "report");
writeJson(path.join(OUT_DIR, "full100-final-dump.json"), finalDump);
writeJson(path.join(OUT_DIR, "full100-report.json"), report);
log("FINAL", {
  run: finalDump.run,
  universe: finalDump.universe,
  jobCounts: finalDump.jobCounts,
  integrity: finalDump.integrity,
  durationMs: Date.now() - t0,
});

await browser.close();
const failed = (finalDump.jobCounts?.FAILED ?? 0) > 0 && (finalDump.run?.status !== "COMPLETE" || (finalDump.jobCounts?.QUEUED ?? 0) > 0);
const paused = finalDump.run?.status === "PAUSED";
process.exit(paused ? 10 : failed && (finalDump.jobCounts?.QUEUED ?? 0) > 0 ? 11 : 0);
