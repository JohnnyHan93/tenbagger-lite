import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageTitle, SafetyNote } from "@/components/shell";
import { buildQueue } from "@/lib/engines/run";
import { displayTicker, formatPct } from "@/lib/format";
import { buildCoverageReport } from "@/lib/research/coverage-report";
import { buildUniverseJobs, EXECUTE_FULL_100, preflight } from "@/lib/research/jobs";
import { SAMPLE_RESEARCH_100 } from "@/lib/sample-research-100";
import { latestSnapshot, useAppStore } from "@/lib/store";

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

  return (
    <>
      <PageTitle kicker="Research Queue" title="조사 큐" />
      <section className="mb-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Full 100</p>
        <p className="mt-2 text-sm">
          상태 <span className="font-mono">READY</span> · 실행 플래그{" "}
          <span className="font-mono">EXECUTE_FULL_100 = NO</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          유니버스 분석 {flight.researchedUniverse} / 100 · 남은 {flight.remaining} · 유니버스 밖 Smoke{" "}
          {flight.extraResearched}. 기존 12건은 유지한다. 대량 리서치는 채팅에서 명시하기 전에는 시작하지 않는다.
        </p>
        <p className="mt-2 text-xs text-subtle">
          비용 안전: 남은 {flight.remaining}종 × (시세 + 재무 공시). 동시성 2–4. 플래그{" "}
          <span className="font-mono">{EXECUTE_FULL_100 ? "YES" : "NO"}</span> · 유료 배치 미시작.
        </p>
        <ul className="mt-3 grid gap-1 font-mono text-xs text-muted md:grid-cols-2">
          <li>P0 tests {flight.p0Tests ? "PASS" : "WAIT"}</li>
          <li>Build {flight.productionBuild ? "PASS" : "WAIT"}</li>
          <li>Universe 100 {flight.universe100 ? "PASS" : "FAIL"}</li>
          <li>Smoke retained {flight.smoke12Retained ? "PASS" : "FAIL"}</li>
          <li>Fake demo {flight.fakeDemoZero ? "0" : "PRESENT"}</li>
          <li>기존 분석 보존 {flight.existingPreserved ? "PASS" : "FAIL"}</li>
        </ul>
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
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-3 py-3">Pri</th>
              <th className="px-3 py-3">Ticker</th>
              <th className="px-3 py-3">Engine</th>
              <th className="px-3 py-3">Factor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.slice(0, 40).map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2 font-mono text-xs">{it.priority}</td>
                <td className="px-3 py-2">
                  {it.ticker ? (
                    <Link
                      to="/company/$ticker"
                      params={{ ticker: encodeURIComponent(it.ticker) }}
                      className="font-mono text-sage"
                    >
                      {displayTicker(it.ticker)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{it.engine}</td>
                <td className="px-3 py-2">
                  <p className="font-mono text-xs">{it.factor}</p>
                  <p className="text-xs text-subtle">{it.reason}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SafetyNote />
    </>
  );
}
