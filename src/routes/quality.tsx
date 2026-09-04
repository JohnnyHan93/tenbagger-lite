import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { FlagBadge, GradeBadge } from "@/components/ui/badge";
import { displayTicker, ENGINE_TAB, formatQualityScore } from "@/lib/format";
import { rankCompanies } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/quality")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const rows = rankCompanies(companies, snapshots).sort(
    (a, b) => (b.snapshot.quality.score ?? -1) - (a.snapshot.quality.score ?? -1),
  );
  return (
    <>
      <PageTitle kicker={ENGINE_TAB.quality.version} title={ENGINE_TAB.quality.name} />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        N/A는 0점이 아닙니다. Diagnostic은 기본 점수에 넣지 않습니다. 74 Factor는 실험 모델로 섞지 않습니다.
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-3 py-3">Ticker</th>
              <th className="px-3 py-3 text-right">Score 0–100</th>
              <th className="px-3 py-3">Grade</th>
              <th className="px-3 py-3">Flags</th>
              <th className="px-3 py-3 text-right">Covered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-muted" colSpan={5}>
                  분석된 종목이 없습니다. Quality 70 점수는 시드하지 않습니다.
                </td>
              </tr>
            ) : null}
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
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatQualityScore(r.snapshot.quality.score)}
                </td>
                <td className="px-3 py-3">
                  <GradeBadge grade={r.snapshot.quality.grade} />
                </td>
                <td className="px-3 py-3">
                  <FlagBadge status={r.snapshot.quality.redFlag === "UNKNOWN" ? "YELLOW" : r.snapshot.quality.redFlag} />
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs">
                  {r.snapshot.quality.scoredCount}/{r.snapshot.quality.eligibleCount}
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
