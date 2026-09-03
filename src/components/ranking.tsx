import { Link } from "@tanstack/react-router";
import { FeasibilityBadge, GradeBadge } from "@/components/ui/badge";
import { displayTicker, formatDate, signedChange } from "@/lib/format";
import type { RankRow } from "@/lib/selectors";
import { cn } from "@/lib/utils";

export function RankingList({ rows }: { rows: RankRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-surface px-5 py-10 text-center shadow-[var(--shadow-border)]">
        <p className="masthead text-xl">아직 분석이 없습니다</p>
        <p className="mt-2 text-sm text-muted">티커 하나로 시작하세요.</p>
        <Link
          to="/analyze"
          className="mt-4 inline-flex h-11 items-center rounded-[var(--radius-md)] bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          분석하기
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)] md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">10x</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3">Last</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.company.id} className="hover:bg-elevated/50">
                <td className="px-4 py-3 font-mono text-xs text-subtle">{r.rank}</td>
                <td className="px-4 py-3">
                  <Link
                    to="/company/$ticker"
                    params={{ ticker: encodeURIComponent(r.company.ticker) }}
                    className="font-mono text-fg hover:text-sage"
                  >
                    {displayTicker(r.company.ticker)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{r.company.companyName}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {Math.round(r.analysis.adjustedScore)}
                </td>
                <td className="px-4 py-3">
                  <GradeBadge grade={r.analysis.grade} />
                </td>
                <td className="px-4 py-3">
                  <FeasibilityBadge value={r.analysis.tenxFeasibility} />
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-mono tabular-nums",
                    (r.change ?? 0) > 0 && "text-grade-a",
                    (r.change ?? 0) < 0 && "text-grade-d",
                    r.change == null && "text-subtle",
                  )}
                >
                  {r.change == null ? "—" : signedChange(Math.round(r.change))}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {formatDate(r.analysis.analysisDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <Link
            key={r.company.id}
            to="/company/$ticker"
            params={{ ticker: encodeURIComponent(r.company.ticker) }}
            className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-subtle">#{r.rank}</p>
                <p className="font-mono text-sm text-sage">{displayTicker(r.company.ticker)}</p>
                <p className="mt-0.5 text-base text-fg">{r.company.companyName}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl tabular-nums">
                  {Math.round(r.analysis.adjustedScore)}
                </p>
                <div className="mt-1 flex justify-end gap-1">
                  <GradeBadge grade={r.analysis.grade} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <FeasibilityBadge value={r.analysis.tenxFeasibility} />
              <span className="font-mono">
                {r.change == null ? "—" : signedChange(Math.round(r.change))} ·{" "}
                {formatDate(r.analysis.analysisDate)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
