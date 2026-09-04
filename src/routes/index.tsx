import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageTitle, SafetyNote } from "@/components/shell";
import { SummaryChips } from "@/components/score-card";
import { TagRow } from "@/components/snapshot-view";
import { Button } from "@/components/ui/button";
import { exportMatrixCsv, exportMatrixXlsx } from "@/lib/export";
import { dashboardStats, rosterCompanies } from "@/lib/selectors";
import { buildCoverageReport } from "@/lib/research/coverage-report";
import { useAppStore } from "@/lib/store";
import { APP_NAME } from "@/lib/brand";
import { CompanyTicker, FREEZE_COL } from "@/components/company-ticker";
import { ENGINE_TAB, formatOppScore, formatPct, formatQualityScore, formatXScore } from "@/lib/format";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const hydrated = useAppStore((s) => s.hydrated);
  const stats = dashboardStats(companies, snapshots);
  const coverage = useMemo(() => buildCoverageReport(companies, snapshots), [companies, snapshots]);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const rows = useMemo(() => {
    const all = rosterCompanies(companies, snapshots);
    if (filter === "pending") return all.filter((r) => r.pending);
    if (filter === "done") return all.filter((r) => !r.pending);
    return all;
  }, [companies, snapshots, filter]);

  return (
    <>
      <PageTitle
        kicker={APP_NAME}
        title="대시보드"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportMatrixCsv(companies, snapshots)}>
              CSV
            </Button>
            <Button variant="secondary" onClick={() => exportMatrixXlsx(companies, snapshots)}>
              XLSX
            </Button>
            <Link to="/discover">
              <Button>티커 분석</Button>
            </Link>
          </div>
        }
      />
      <SummaryChips
        items={[
          { label: "유니버스", value: stats.total },
          { label: "US / KR", value: `${stats.us} / ${stats.kr}` },
          { label: "미분석", value: stats.pending },
          { label: "분석됨", value: stats.analyzed },
        ]}
      />
      {coverage.analyzed > 0 ? (
        <p className="mt-3 font-mono text-xs text-muted">
          Coverage X {formatPct(coverage.xbaggerAvg)} · Oversold {formatPct(coverage.oversoldAvg)} · Quality{" "}
          {formatPct(coverage.qualityAvg)} · US {coverage.usAnalyzed} / KR {coverage.krAnalyzed} · 낮은 커버리지{" "}
          {coverage.lowCoverage}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {(
          [
            ["all", `전체 ${stats.total}`],
            ["pending", `미분석 ${stats.pending}`],
            ["done", `분석됨 ${stats.analyzed}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 font-mono ${filter === key ? "bg-sage text-bg" : "bg-elevated text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!hydrated ? <p className="mt-4 text-sm text-muted">불러오는 중…</p> : null}
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="idt-table min-w-[880px] w-max text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className={FREEZE_COL}>종목</th>
              <th className="px-3 py-3">Market</th>
              <th className="px-3 py-3 text-right">
                {ENGINE_TAB.xbagger.name}
                <span className="block font-normal tracking-normal text-subtle">0–100</span>
              </th>
              <th className="px-3 py-3 text-right">
                {ENGINE_TAB.oversold.name}
                <span className="block font-normal tracking-normal text-subtle">0–10</span>
              </th>
              <th className="px-3 py-3 text-right">
                Value Trap
                <span className="block font-normal tracking-normal text-subtle">1–10</span>
              </th>
              <th className="px-3 py-3 text-right">
                {ENGINE_TAB.quality.name}
                <span className="block font-normal tracking-normal text-subtle">0–100</span>
              </th>
              <th className="px-3 py-3">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.company.id} className="hover:bg-elevated/50">
                <td className={FREEZE_COL}>
                  <CompanyTicker ticker={r.company.ticker} name={r.company.companyName} />
                </td>
                <td className="px-3 py-3 font-mono text-xs text-subtle">
                  {r.company.country}
                  {r.company.testProfile ? (
                    <span className="mt-0.5 block text-[0.625rem] tracking-wide">{r.company.testProfile}</span>
                  ) : null}
                </td>
                {r.snapshot ? (
                  <>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatXScore(r.snapshot.xbagger.adjustedScore)}
                      <span className="ml-2 text-subtle">{r.snapshot.xbagger.grade}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatOppScore(r.snapshot.oversold.opportunity)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {r.snapshot.oversold.valueTrap} / 10
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {formatQualityScore(r.snapshot.quality.score)}
                      <span className="ml-2 text-subtle">{r.snapshot.quality.grade}</span>
                    </td>
                    <td className="px-3 py-3">
                      <TagRow tags={r.snapshot.tags.slice(0, 2)} />
                    </td>
                  </>
                ) : (
                  <>
                    <td colSpan={5} className="px-3 py-3 text-xs text-muted">
                      미분석 — 발굴에서 ANALYZE. 점수는 시드하지 않습니다.
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SafetyNote />
    </>
  );
}
