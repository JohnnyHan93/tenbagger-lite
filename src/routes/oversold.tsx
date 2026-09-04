import { createFileRoute } from "@tanstack/react-router";
import { CompanyTicker, FREEZE_NAME_AFTER_RANK, FREEZE_RANK } from "@/components/company-ticker";
import { PageTitle, SafetyNote } from "@/components/shell";
import { ENGINE_TAB, formatOppScore } from "@/lib/format";
import { oversoldRank } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/oversold")({ component: Page });

function Table({ market }: { market: "KR" | "US" }) {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const rows = oversoldRank(companies, snapshots, market);
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
      <table className="idt-table w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
          <tr>
            <th className={FREEZE_RANK}>#</th>
            <th className={FREEZE_NAME_AFTER_RANK}>종목</th>
            <th className="px-3 py-3 text-right">Opp 0–10</th>
            <th className="px-3 py-3">Case</th>
            <th className="px-3 py-3 text-right">Value Trap 1–10</th>
            <th className="px-3 py-3">Peak</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-sm text-muted" colSpan={6}>
                {market} 유니버스에 과매도 후보가 없습니다. Discover에서 티커를 넣으세요.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.company.id}>
                <td className={`${FREEZE_RANK} font-mono text-[0.625rem] text-subtle`}>{r.rank}</td>
                <td className={FREEZE_NAME_AFTER_RANK}>
                  <CompanyTicker ticker={r.company.ticker} name={r.company.companyName} />
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatOppScore(r.snapshot.oversold.opportunity)}
                </td>
                <td className="px-3 py-3 font-mono">{r.snapshot.oversold.case}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{r.snapshot.oversold.valueTrap} / 10</td>
                <td className="px-3 py-3 text-xs">{r.snapshot.oversold.peakEarnings ? "YES" : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Page() {
  return (
    <>
      <PageTitle kicker={ENGINE_TAB.oversold.version} title={ENGINE_TAB.oversold.name} />
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Opp = 0.40F + 0.25V + 0.10O + 0.25R. Value Trap은 별도입니다. 싸진 것과 망가진 것을 섞지 않습니다.
      </p>
      <h2 className="mb-2 font-mono text-xs tracking-widest text-sage uppercase">Korea Top 10</h2>
      <Table market="KR" />
      <h2 className="mb-2 mt-8 font-mono text-xs tracking-widest text-sage uppercase">US Top 10</h2>
      <Table market="US" />
      <SafetyNote />
    </>
  );
}
