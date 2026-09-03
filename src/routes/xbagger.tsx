import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { GradeBadge, FeasibilityBadge } from "@/components/ui/badge";
import { displayTicker, ENGINE_TAB, formatXScore } from "@/lib/format";
import { rankCompanies } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/xbagger")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const rows = rankCompanies(companies, snapshots).sort(
    (a, b) => b.snapshot.xbagger.adjustedScore - a.snapshot.xbagger.adjustedScore,
  );
  return (
    <>
      <PageTitle kicker={ENGINE_TAB.xbagger.version} title={ENGINE_TAB.xbagger.name} />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        10 Factor × 0–10, 가중합 0–100. N/A는 분모에서 제외. Hard Gate(10x / Survival)는 평균과 섞지 않습니다.
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-3 py-3">Ticker</th>
              <th className="px-3 py-3 text-right">Score 0–100</th>
              <th className="px-3 py-3">Grade</th>
              <th className="px-3 py-3">10x</th>
              <th className="px-3 py-3">Gates</th>
              <th className="px-3 py-3 text-right">Cov</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.company.id}>
                <td className="px-3 py-3">
                  <Link
                    to="/company/$ticker"
                    params={{ ticker: encodeURIComponent(r.company.ticker) }}
                    className="font-mono text-sage"
                  >
                    {displayTicker(r.company.ticker)}
                  </Link>
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{formatXScore(r.snapshot.xbagger.adjustedScore)}</td>
                <td className="px-3 py-3">
                  <GradeBadge grade={r.snapshot.xbagger.grade} />
                </td>
                <td className="px-3 py-3">
                  <FeasibilityBadge value={r.snapshot.xbagger.tenxFeasibility} />
                </td>
                <td className="px-3 py-3 font-mono text-xs text-muted">
                  T {r.snapshot.xbagger.gates.tenx} · S {r.snapshot.xbagger.gates.survival}
                </td>
                <td className="px-3 py-3 text-right font-mono">{Math.round(r.snapshot.xbagger.coverage * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SafetyNote />
    </>
  );
}
