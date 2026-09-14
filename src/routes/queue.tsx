import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyTicker, FREEZE_COL } from "@/components/company-ticker";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buildQueue } from "@/lib/engines/run";
import { exportFull100Csv, exportFull100Json, exportMatrixCsv } from "@/lib/export";
import { buildFull100Report } from "@/lib/research/full100-report";
import { displayTicker, formatPct } from "@/lib/format";
import { buildCoverageReport } from "@/lib/research/coverage-report";
import { buildUniverseJobs, EXECUTE_FULL_100, preflight } from "@/lib/research/jobs";
import { LAST_VERIFIED_BUILD } from "@/lib/research/verified-build";
import { SAMPLE_RESEARCH_100 } from "@/lib/sample-research-100";
import { latestSnapshot, useAppStore } from "@/lib/store";
import type { LivePreflightResult } from "@/lib/research/preflight";
import type { Smoke12OneResult, Smoke12Status } from "@/lib/research/smoke12";
import type { Full100OneResult, Full100Status } from "@/lib/research/full100";

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
  const fullReport = useMemo(() => buildFull100Report(companies, snapshots), [companies, snapshots]);
  const flight = useMemo(() => preflight(companies, snapshots), [companies, snapshots]);
  const jobs = useMemo(() => buildUniverseJobs(companies, snapshots), [companies, snapshots]);
  const remaining = jobs.filter((j) => j.status === "NOT_RESEARCHED");
  const [live, setLive] = useState<LivePreflightResult | null>(null);
  const [run, setRun] = useState<QueueRunDto | null>(null);
  const [runJobs, setRunJobs] = useState<QueueJobDto[]>([]);
  const [smoke, setSmoke] = useState<Smoke12Status | null>(null);
  const [smokeBusy, setSmokeBusy] = useState(false);
  const [smokeCurrent, setSmokeCurrent] = useState<string | null>(null);
  const [smokeLog, setSmokeLog] = useState<Smoke12OneResult[]>([]);
  const smokeAuto = useRef(false);
  const [full, setFull] = useState<Full100Status | null>(null);
  const [fullBusy, setFullBusy] = useState(false);
  const [fullCurrent, setFullCurrent] = useState<string | null>(null);
  const [fullLog, setFullLog] = useState<Full100OneResult[]>([]);
  const fullAuto = useRef(false);
  const fullStop = useRef(false);

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
        smokeStatus: () => actions.smoke12StatusFn(),
        smokeOne: (ticker: string) => actions.smoke12OneFn({ data: { ticker } }),
        fullStatus: () => actions.full100StatusFn(),
        fullOne: (ticker: string) => actions.full100OneFn({ data: { ticker } }),
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { smoke12StatusFn, full100StatusFn } = await import("@/lib/persist/actions");
        const [s, f] = await Promise.all([smoke12StatusFn(), full100StatusFn()]);
        if (cancelled) return;
        setSmoke(s);
        setFull(f);
      } catch {
        if (!cancelled) {
          setSmoke(null);
          setFull(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companies, snapshots]);

  async function runSmoke12() {
    if (smokeBusy) return;
    const { smoke12StatusFn, smoke12OneFn, loadWorkspaceFn } = await import("@/lib/persist/actions");
    setSmokeBusy(true);
    try {
      let status = await smoke12StatusFn();
      setSmoke(status);
      if (!status.durable) return;
      const todo = status.rows.filter((r) => !r.hasSnapshot);
      for (const row of todo) {
        setSmokeCurrent(row.ticker);
        const result = await smoke12OneFn({ data: { ticker: row.ticker } });
        setSmokeLog((prev) => [...prev, result]);
        status = await smoke12StatusFn();
        setSmoke(status);
        try {
          const db = await loadWorkspaceFn();
          useAppStore.getState().hydrateFromDb(db);
        } catch {
          /* keep local */
        }
      }
    } finally {
      setSmokeCurrent(null);
      setSmokeBusy(false);
    }
  }

  useEffect(() => {
    if (smokeAuto.current) return;
    if (!smoke?.durable || smoke.remaining === 0 || smokeBusy) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("run") !== "smoke12") return;
    smokeAuto.current = true;
    void runSmoke12();
  }, [smoke, smokeBusy]);

  async function runFull100() {
    if (fullBusy) return;
    const { full100StatusFn, full100OneFn, loadWorkspaceFn } = await import("@/lib/persist/actions");
    fullStop.current = false;
    setFullBusy(true);
    try {
      let status = await full100StatusFn();
      setFull(status);
      if (!status.durable || !status.authorized) return;
      const todo = status.remainingTickers.slice();
      for (const ticker of todo) {
        if (fullStop.current) break;
        setFullCurrent(ticker);
        const result = await full100OneFn({ data: { ticker } });
        setFullLog((prev) => [...prev, result]);
        status = await full100StatusFn();
        setFull(status);
        try {
          const db = await loadWorkspaceFn();
          useAppStore.getState().hydrateFromDb(db);
        } catch {
          /* keep local */
        }
      }
    } finally {
      setFullCurrent(null);
      setFullBusy(false);
    }
  }

  useEffect(() => {
    if (fullAuto.current) return;
    if (!full?.durable || !full.authorized || full.remaining === 0 || fullBusy) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("run") !== "full100") return;
    fullAuto.current = true;
    void runFull100();
  }, [full, fullBusy]);

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
        <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Smoke 12</p>
        <p className="mt-2 text-sm">
          Sample100 보존 3 (INOD · 삼성전자 · KB금융) + 유니버스 밖 9. Full 100과 별개.{" "}
          <span className="font-mono">
            {smoke ? `${smoke.done}/12` : "…"}
          </span>
          {smoke ? ` · 유니버스 ${smoke.universeDone}/3 · 추가 ${smoke.extraDone}/9` : null}
        </p>
        <p className="mt-1 text-xs text-muted">
          {smoke?.durable
            ? "Neon에 저장합니다. 이미 분석된 종목은 건너뜁니다."
            : "이 미리보기는 PGLite입니다. 게시된 idt.grok.me Neon에서만 실행합니다."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!smoke?.durable || smokeBusy || (smoke?.remaining ?? 0) === 0}
            onClick={() => void runSmoke12()}
          >
            {smokeBusy
              ? `분석 중 ${smokeCurrent ?? ""}`
              : !smoke?.durable
                ? "Neon에서만 실행"
                : (smoke?.remaining ?? 0) === 0
                  ? "Smoke 12 완료"
                  : `Smoke 12 실행 (${smoke?.remaining ?? 12})`}
          </Button>
        </div>
        {smokeCurrent ? (
          <p className="mt-2 font-mono text-xs text-sage">진행 {displayTicker(smokeCurrent)}</p>
        ) : null}
        <ul className="mt-3 grid gap-1 font-mono text-xs md:grid-cols-3">
          {(smoke?.rows ?? []).map((r) => (
            <li key={r.ticker} className="truncate text-muted">
              {displayTicker(r.ticker)} · {r.name}
              <span className="text-subtle">
                {" "}
                {r.hasSnapshot ? r.status : "미분석"}
                {r.inUniverse ? " · U" : ""}
              </span>
            </li>
          ))}
        </ul>
        {smokeLog.length > 0 ? (
          <ul className="mt-3 grid gap-1 font-mono text-[0.65rem] text-subtle">
            {smokeLog.map((row, i) => (
              <li key={`${row.ticker}-${i}`}>
                {displayTicker(row.ticker)} {row.ok ? (row.skipped ? "skip" : row.status) : row.error}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="mb-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Full 100</p>
        <p className="mt-2 text-sm">
          상태{" "}
          <span className="font-mono">
            {fullBusy
              ? "RUNNING"
              : (full?.researched ?? flight.researchedUniverse) >= 100
                ? "COMPLETE"
                : EXECUTE_FULL_100
                  ? "AUTHORIZED"
                  : "LOCKED"}
          </span>{" "}
          · 실행기 <span className="font-mono">{executorLabel}</span> · 권한{" "}
          <span className="font-mono">{EXECUTE_FULL_100 ? "YES" : "NO"}</span> · 플래그{" "}
          <span className="font-mono">EXECUTE_FULL_100 = {EXECUTE_FULL_100 ? "YES" : "NO"}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          유니버스 분석 {full?.researched ?? live?.researchedUniverse ?? flight.researchedUniverse} / 100 · 남은{" "}
          {full?.remaining ?? live?.remaining ?? flight.remaining} · 유니버스 밖 보존{" "}
          {full?.extraPreserved ?? live?.extraResearched ?? flight.extraResearched}. 기존 스냅샷은 건너뛴다.
        </p>
        <p className="mt-1 text-xs text-muted">
          {full?.durable
            ? "Neon에만 저장. 탭을 닫으면 멈춘다. 다시 누르면 남은 종목만 이어서 한다."
            : "이 미리보기는 PGLite입니다. 게시된 idt.grok.me Neon에서만 실행합니다."}
        </p>
        {run ? (
          <p className="mt-2 font-mono text-xs text-muted">
            Run {run.id} · {run.status} · {complete}/{run.totalJobs} · 실패 {failed} · Partial {partial} · RR {required}
            {researching[0] ? ` · 조사중 ${displayTicker(researching[0].ticker)} retry ${researching[0].attemptCount}/3` : ""}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!EXECUTE_FULL_100 || !full?.durable || fullBusy || (full?.remaining ?? 0) === 0}
            onClick={() => void runFull100()}
          >
            {fullBusy
              ? `분석 중 ${fullCurrent ?? ""}`
              : !full?.durable
                ? "Neon에서만 실행"
                : (full?.remaining ?? 0) === 0
                  ? "Full 100 완료"
                  : `Full 100 실행 (${full?.remaining ?? "…"})`}
          </Button>
          {fullBusy ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                fullStop.current = true;
              }}
            >
              일시정지
            </Button>
          ) : null}
        </div>
        {fullCurrent ? (
          <p className="mt-2 font-mono text-xs text-sage">진행 {displayTicker(fullCurrent)}</p>
        ) : null}
        {fullLog.length > 0 ? (
          <ul className="mt-3 grid max-h-40 gap-1 overflow-y-auto font-mono text-[0.65rem] text-subtle">
            {fullLog.slice(-24).map((row, i) => (
              <li key={`${row.ticker}-${i}`}>
                {displayTicker(row.ticker)} {row.ok ? (row.skipped ? "skip" : row.status) : row.error}
              </li>
            ))}
          </ul>
        ) : null}
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
            <li>EXECUTE_FULL_100 {EXECUTE_FULL_100 ? "YES" : "NO"}</li>
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
      </section>

      <section className="mb-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Full 100 결과</p>
        <p className="mt-2 text-sm">
          유니버스 {fullReport.universe.analyzed} / {fullReport.universe.sample100} · 유니버스 밖 보존{" "}
          {fullReport.universe.extraSmoke} · Fake demo {fullReport.universe.fakeDemo}
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          Coverage X {fullReport.fmt.xbaggerAvg}% · Oversold {fullReport.fmt.oversoldAvg}% · Quality{" "}
          {fullReport.fmt.qualityAvg}% · 중앙값 {fullReport.fmt.medianOverall}%
        </p>
        <p className="mt-1 text-xs text-muted">
          US {fullReport.coverage.us.n} · KR {fullReport.coverage.kr.n}. RESEARCH_REQUIRED는 공시 공백이다. 세 점수는 합치지
          않는다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => exportFull100Csv(companies, snapshots)}>
            Full 100 CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void exportFull100Json(companies, snapshots);
            }}
          >
            리포트 JSON
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportMatrixCsv(companies, snapshots)}>
            전체 매트릭스 CSV
          </Button>
        </div>
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
