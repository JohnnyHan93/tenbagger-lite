import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CompanyTicker, FREEZE_COL } from "@/components/company-ticker";
import { PageTitle, SafetyNote } from "@/components/shell";
import { buildQueue } from "@/lib/engines/run";
import { displayTicker, formatPct } from "@/lib/format";
import { buildCoverageReport } from "@/lib/research/coverage-report";
import { buildUniverseJobs, EXECUTE_FULL_100, preflight } from "@/lib/research/jobs";
import { LAST_VERIFIED_BUILD } from "@/lib/research/verified-build";
import { SAMPLE_RESEARCH_100 } from "@/lib/sample-research-100";
import { latestSnapshot, useAppStore } from "@/lib/store";
import type { LivePreflightResult } from "@/lib/research/preflight";

type QueueRunDto = {
  id: string;
  status: string;
  type: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
};

type QueueJobDto = {
  id: string;
  ticker: string;
  status: string;
  attemptCount: number;
  failureClass: string | null;
  lastError: string | null;
};

export const Route = createFileRoute("/queue")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const latest = companies
    .map((c) => latestSnapshot(snapshots, c.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const items = buildQueue(latest).map((it) => {
    const c = companies.find((x) => x.id === it.companyId);
    return { ...it, ticker: c?.ticker ?? "" };
  });
  const report = useMemo(() => buildCoverageReport(companies, snapshots), [companies, snapshots]);
  const flight = useMemo(() => preflight(companies, snapshots), [companies, snapshots]);
  const jobs = useMemo(() => buildUniverseJobs(companies, snapshots), [companies, snapshots]);
  const remaining = jobs.filter((j) => j.status === "NOT_RESEARCHED");
  const [live, setLive] = useState<LivePreflightResult | null>(null);
  const [run, setRun] = useState<QueueRunDto | null>(null);
  const [runJobs, setRunJobs] = useState<QueueJobDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { livePreflightFn, queueStateFn } = await import("@/lib/persist/actions");
        const [p, q] = await Promise.all([livePreflightFn(), queueStateFn()]);
        if (cancelled) return;
        setLive(p);
        setRun(q.run);
        setRunJobs(q.jobs);
      } catch {
        if (!cancelled) setLive(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companies, snapshots]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFromDb = useAppStore.getState().hydrateFromDb;
    const tick = async () => {
      try {
        const { queueStateFn, loadWorkspaceFn } = await import("@/lib/persist/actions");
        const q = await queueStateFn();
        if (cancelled) return;
        setRun(q.run);
        setRunJobs(q.jobs);
        if (q.run && (q.run.status === "RUNNING" || q.run.status === "COMPLETE" || q.run.status === "PAUSED")) {
          const db = await loadWorkspaceFn();
          if (!cancelled) hydrateFromDb(db);
        }
      } catch {
        /* keep last */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const w = window as unknown as { __idtOperator?: unknown };
    let cancelled = false;
    void (async () => {
      const actions = await import("@/lib/persist/actions");
      if (cancelled) return;
      w.__idtOperator = {
        preflight: () => actions.livePreflightFn(),
        queue: () => actions.queueStateFn(),
        dump: () => actions.full100DumpFn(),
        report: () => actions.full100ReportFn(),
        checkpoint: () => actions.full100CheckpointFn(),
        start: () => actions.v24StartFn(),
        chunk: (runId: string) => actions.v24ChunkFn({ data: { runId } }),
        researchOne: (ticker: string) => actions.v24ResearchOneFn({ data: { ticker } }),
        pause: (runId: string) => actions.pauseFull100Fn({ data: { runId } }),
        resume: (runId: string) => actions.resumeFull100Fn({ data: { runId } }),
        load: () => actions.loadWorkspaceFn(),
      };
    })();
    return () => {
      cancelled = true;
      delete w.__idtOperator;
    };
  }, []);

  const researching = runJobs.filter((j) => j.status === "RESEARCHING");
  const failed = runJobs.filter((j) => j.status === "FAILED").length;
  const partial = runJobs.filter((j) => j.status === "PARTIAL").length;
  const required = runJobs.filter((j) => j.status === "RESEARCH_REQUIRED").length;
  const complete = runJobs.filter((j) => j.status === "COMPLETE" || j.status === "PARTIAL" || j.status === "RESEARCH_REQUIRED").length;
  const sha = LAST_VERIFIED_BUILD.commitSha.slice(0, 7);
  const liveReady = Boolean(live);
  const liveMark = (pass: boolean | undefined) => {
    if (!liveReady) return "UNKNOWN";
    return pass ? "PASS" : "FAIL";
  };
  const executorLabel = !liveReady ? "UNKNOWN" : live?.executorReady ? "READY" : "NOT READY";

  return (
    <>
      <PageTitle kicker="Research Queue" title="조사 큐" />
      <section className="mb-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Full 100</p>
        <p className="mt-2 text-sm">
          상태 <span className="font-mono">LOCKED</span> · 실행기{" "}
          <span className="font-mono">{executorLabel}</span> · 권한{" "}
          <span className="font-mono">NO</span> · 플래그{" "}
          <span className="font-mono">EXECUTE_FULL_100 = NO</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          Explicit authorization required. 유니버스 분석 {live?.researchedUniverse ?? flight.researchedUniverse} / 100 ·
          남은 {live?.remaining ?? flight.remaining} · 유니버스 밖 Smoke{" "}
          {live?.extraResearched ?? flight.extraResearched}. 기존 12건은 유지한다.
        </p>
        {run ? (
          <p className="mt-2 font-mono text-xs text-muted">
            Run {run.id} · {run.status} · {complete}/{run.totalJobs} · 실패 {failed} · Partial {partial} · RR {required}
            {researching[0] ? ` · 조사중 ${displayTicker(researching[0].ticker)} retry ${researching[0].attemptCount}/3` : ""}
          </p>
        ) : (
          <p className="mt-2 font-mono text-xs text-subtle">Run 없음 · remaining {live?.remaining ?? flight.remaining} · 시작하지 않음</p>
        )}
        <p className="mt-2 text-xs text-subtle">
          청크 3종목. 재시도 429/timeout. Resume RESEARCHING→QUEUED.
          {run ? ` 배치 ${run.status}.` : " 유료 배치는 통제 실행으로만 시작."}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ul className="grid gap-1 font-mono text-xs text-muted">
            <li className="text-[0.625rem] tracking-widest text-sage uppercase">LIVE CHECK</li>
            <li>DB {liveMark(live?.dbAvailable)}</li>
            <li>Universe 100 {liveMark(live?.universe100)}</li>
            <li>US50/KR50 {liveMark(Boolean(live?.us50 && live?.kr50))}</li>
            <li>Fake demo {liveReady ? (live?.fakeDemoZero ? "0" : "PRESENT") : "UNKNOWN"}</li>
            <li>기존 분석 보존 {liveMark(live?.existingPreserved)}</li>
            <li>Queue tables {liveMark(live?.queuePersistence)}</li>
            <li>활성 충돌 {liveReady ? (live?.noActiveConflict === false ? "YES" : "NONE") : "UNKNOWN"}</li>
            <li>시세 경로 {liveMark(live?.providerConfig)}</li>
            <li>EXECUTE_FULL_100 NO</li>
          </ul>
          <ul className="grid gap-1 font-mono text-xs text-muted">
            <li className="text-[0.625rem] tracking-widest text-sage uppercase">LAST VERIFIED BUILD</li>
            <li>Typecheck {LAST_VERIFIED_BUILD.typecheck} · {sha}</li>
            <li>Lint {LAST_VERIFIED_BUILD.lint} · {sha}</li>
            <li>Tests {LAST_VERIFIED_BUILD.tests} · {sha}</li>
            <li>Production Build {LAST_VERIFIED_BUILD.productionBuild} · {sha}</li>
            <li className="text-subtle">{LAST_VERIFIED_BUILD.verifiedAt}</li>
          </ul>
        </div>
        {!EXECUTE_FULL_100 ? (
          <p className="mt-3 rounded-[var(--radius-md)] bg-elevated px-3 py-2 text-xs text-muted">
            FULL 100 LOCKED — Explicit authorization required
          </p>
        ) : null}
      </section>

      <section className="mb-4 overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <p className="px-3 pt-3 font-mono text-[0.625rem] tracking-widest text-sage uppercase">US vs KR coverage</p>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-3 py-2">Engine</th>
              <th className="px-3 py-2 text-right">US</th>
              <th className="px-3 py-2 text-right">KR</th>
              <th className="px-3 py-2 text-right">Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.engines.map((e) => (
              <tr key={e.engine}>
                <td className="px-3 py-2">{e.engine}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPct(e.us)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPct(e.kr)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPct(e.gap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-3 text-xs text-subtle">
          평균 X {formatPct(report.xbaggerAvg)} · Oversold {formatPct(report.oversoldAvg)} · Quality{" "}
          {formatPct(report.qualityAvg)} · 중앙값 {formatPct(report.medianOverall)}. 커버리지를 점수로 올리지 않는다.
        </p>
      </section>

      <section className="mb-4 overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <p className="px-3 pt-3 font-mono text-[0.625rem] tracking-widest text-sage uppercase">Adapter</p>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-3 py-2">Adapter</th>
              <th className="px-3 py-2 text-right">N</th>
              <th className="px-3 py-2 text-right">Coverage</th>
              <th className="px-3 py-2 text-right">RR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.adapters.map((a) => (
              <tr key={a.adapter}>
                <td className="px-3 py-2">{a.adapter}</td>
                <td className="px-3 py-2 text-right font-mono">{a.companies}</td>
                <td className="px-3 py-2 text-right font-mono">{formatPct(a.avgCoverage)}</td>
                <td className="px-3 py-2 text-right font-mono">{a.researchRequired}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mb-3 text-sm text-muted">
        미분석 유니버스 {remaining.length}종목. 커버리지가 낮거나 게이트에 가까운 빈 칸을 먼저 채운다. Research
        Priority는 매수 신호가 아니다.
      </p>
      {remaining.length > 0 ? (
        <section className="mb-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Remaining universe</p>
          <ul className="mt-3 grid gap-1 font-mono text-xs md:grid-cols-3">
            {remaining.slice(0, 24).map((j) => {
              const ident = SAMPLE_RESEARCH_100.find((c) => c.ticker === j.ticker);
              return (
                <li key={j.id} className="truncate text-muted">
                  {displayTicker(j.ticker)}
                  {ident ? ` · ${ident.companyName}` : ""}
                </li>
              );
            })}
          </ul>
          {remaining.length > 24 ? (
            <p className="mt-2 text-xs text-subtle">+{remaining.length - 24} 미표시</p>
          ) : null}
        </section>
      ) : null}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="idt-table w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className={FREEZE_COL}>종목</th>
              <th className="px-3 py-3">Pri</th>
              <th className="px-3 py-3">Engine</th>
              <th className="px-3 py-3">Factor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.slice(0, 40).map((it) => {
              const company = companies.find((c) => c.ticker === it.ticker);
              const ident = SAMPLE_RESEARCH_100.find((c) => c.ticker === it.ticker);
              return (
              <tr key={it.id}>
                <td className={FREEZE_COL}>
                  {it.ticker ? (
                    <CompanyTicker
                      ticker={it.ticker}
                      name={company?.companyName ?? ident?.companyName ?? it.ticker}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{it.priority}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{it.engine}</td>
                <td className="px-3 py-2">
                  <p className="font-mono text-xs">{it.factor}</p>
                  <p className="text-xs text-subtle">{it.reason}</p>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SafetyNote />
    </>
  );
}
