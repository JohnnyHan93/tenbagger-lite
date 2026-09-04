import { createFileRoute } from "@tanstack/react-router";
import { CompanyTicker, FREEZE_COL } from "@/components/company-ticker";
import { PageTitle, SafetyNote } from "@/components/shell";
import { ENGINE_TAB, formatDate, formatOppScore, formatQualityScore, formatXScore } from "@/lib/format";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/history")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const rows = [...snapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
  return (
    <>
      <PageTitle kicker="Immutable snapshots" title="이력" />
      <p className="mb-4 text-sm text-muted">Refresh는 과거를 덮지 않습니다. 새 스냅샷이 추가됩니다.</p>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="idt-table w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className={FREEZE_COL}>종목</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-right">{ENGINE_TAB.xbagger.name}</th>
              <th className="px-3 py-3 text-right">{ENGINE_TAB.oversold.name}</th>
              <th className="px-3 py-3 text-right">Value Trap</th>
              <th className="px-3 py-3 text-right">{ENGINE_TAB.quality.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => {
              const c = companies.find((x) => x.id === s.companyId);
              return (
                <tr key={s.id}>
                  <td className={FREEZE_COL}>
                    {c ? (
                      <CompanyTicker ticker={c.ticker} name={c.companyName} />
                    ) : (
                      s.companyId
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{formatDate(s.createdAt)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatXScore(s.xbagger.adjustedScore)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatOppScore(s.oversold.opportunity)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{s.oversold.valueTrap} / 10</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatQualityScore(s.quality.score)}</td>
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
