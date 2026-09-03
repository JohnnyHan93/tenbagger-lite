import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { SummaryChips } from "@/components/score-card";
import { TagRow } from "@/components/snapshot-view";
import { Button } from "@/components/ui/button";
import { dashboardStats, rankCompanies } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";
import { displayTicker, ENGINE_TAB, formatOppScore, formatQualityScore, formatXScore } from "@/lib/format";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const stats = dashboardStats(companies, snapshots);
  const rows = rankCompanies(companies, snapshots).slice(0, 20);

  return (
    <>
      <PageTitle
        kicker="Investment Discovery Terminal"
        title="대시보드"
        action={
          <Link to="/discover">
            <Button>티커 분석</Button>
          </Link>
        }
      />
      <SummaryChips
        items={[
          { label: "X-Bagger A+", value: stats.xDeep },
          { label: "Quality 70 ≥70", value: stats.qualityHigh },
          { label: "Oversold", value: stats.oversold },
          { label: "Research Req", value: stats.research },
        ]}
      />
      <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="min-w-[880px] w-max text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-3 py-3">Ticker</th>
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
                <td className="px-3 py-3">
                  <Link
                    to="/company/$ticker"
                    params={{ ticker: encodeURIComponent(r.company.ticker) }}
                    className="font-mono text-sage"
                  >
                    {displayTicker(r.company.ticker)}
                  </Link>
                  <p className="text-xs text-muted">{r.company.companyName}</p>
                </td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SafetyNote />
    </>
  );
}
