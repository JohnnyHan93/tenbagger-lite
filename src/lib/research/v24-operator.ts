import { tickersEqual } from "../format.ts";
import { uid } from "../utils.ts";
import { createProductionDeps, processFull100Chunk, startFull100FromWorkspace } from "./production.ts";
import type { StartFull100Result } from "./production.ts";
import { researchStatusOf } from "./coverage-report.ts";
import { lookupIdentity } from "./identity.ts";

/**
 * v2.4 controlled Full100 operator.
 * Locked after the authorized initial batch completed.
 */
export const V24_OPERATOR_ENABLED = false;

export function v24OperatorEnabled(): boolean {
  return V24_OPERATOR_ENABLED;
}

export async function v24Start(): Promise<StartFull100Result & { resumed?: boolean }> {
  if (!V24_OPERATOR_ENABLED) {
    return { ok: false, error: "OPERATOR_DISABLED" };
  }
  const { activeFull100Run, recoverStaleJobs, updateResearchRun } = await import("../persist/queue.ts");
  const active = await activeFull100Run();
  if (active) {
    await recoverStaleJobs(active.id);
    if (active.status === "PAUSED" || active.status === "QUEUED") {
      await updateResearchRun(active.id, {
        status: "RUNNING",
        startedAt: active.startedAt ?? new Date().toISOString(),
      });
    }
    return { ok: true, runId: active.id, totalJobs: active.totalJobs, resumed: true };
  }
  return startFull100FromWorkspace({ executeEnabled: true });
}

export async function v24Chunk(runId: string) {
  if (!V24_OPERATOR_ENABLED) {
    return { ok: false, processed: [] as string[], run: null, skipped: "OPERATOR_DISABLED" };
  }
  return processFull100Chunk(runId, {
    executeEnabled: true,
    chunkSize: 3,
    deps: createProductionDeps({ useAi: true }),
  });
}

export async function v24ResearchOne(ticker: string): Promise<{
  ok: boolean;
  ticker: string;
  provider?: string;
  status?: string;
  error?: string;
}> {
  if (!V24_OPERATOR_ENABLED) {
    return { ok: false, ticker, error: "OPERATOR_DISABLED" };
  }
  const { executeResearch } = await import("./ticker.ts");
  const { runSnapshotFromDraft } = await import("../engines/run.ts");
  const { loadWorkspace, saveAnalysisTransaction } = await import("../persist/repo.ts");
  const res = await executeResearch({ ticker, useAi: true });
  if (!res.ok) return { ok: false, ticker, error: res.error };
  const ws = await loadWorkspace();
  const existing = ws.companies.find(
    (c) => tickersEqual(c.ticker, ticker) || tickersEqual(c.ticker, res.draft.quote.ticker),
  );
  const ident = lookupIdentity(res.draft.quote.ticker) ?? lookupIdentity(ticker);
  const now = new Date().toISOString();
  const q = res.draft.quote;
  const company = existing ?? {
    id: uid("c"),
    ticker: q.ticker,
    exchange: ident?.exchange ?? q.exchange,
    companyName: ident?.companyName ?? q.companyName,
    country: ident?.country ?? q.country,
    sector: ident?.sector ?? q.sector,
    industry: ident?.industry ?? q.industry,
    createdAt: now,
    updatedAt: now,
  };
  const snapshot = runSnapshotFromDraft({
    company,
    draft: res.draft,
    researchPriorityOn: true,
  });
  await saveAnalysisTransaction({ company, snapshot });
  return {
    ok: true,
    ticker: company.ticker,
    provider: snapshot.researchProvider,
    status: researchStatusOf(snapshot),
  };
}