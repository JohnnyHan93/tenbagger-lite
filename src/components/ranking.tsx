import { Link } from "@tanstack/react-router";
import { GradeBadge } from "@/components/ui/badge";
import { displayTicker } from "@/lib/format";
import type { RankRow } from "@/lib/selectors";

export function RankingList({ rows }: { rows: RankRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-surface px-5 py-10 text-center shadow-[var(--shadow-border)]">
        <p className="masthead text-xl">아직 분석이 없습니다</p>
        <Link to="/discover" className="mt-4 inline-flex h-11 items-center text-sage">
          발굴로
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
          <tr>
            <th className="px-4 py-3">Ticker</th>
            <th className="px-4 py-3 text-right">X</th>
            <th className="px-4 py-3">Grade</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.company.id}>
              <td className="px-4 py-3">
                <Link
                  to="/company/$ticker"
                  params={{ ticker: encodeURIComponent(r.company.ticker) }}
                  className="font-mono text-sage"
                >
                  {displayTicker(r.company.ticker)}
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-mono">{Math.round(r.snapshot.xbagger.adjustedScore)}</td>
              <td className="px-4 py-3">
                <GradeBadge grade={r.snapshot.xbagger.grade} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
