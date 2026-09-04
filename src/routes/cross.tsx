import { createFileRoute } from "@tanstack/react-router";
import { CompanyTicker, FREEZE_COL } from "@/components/company-ticker";
import { PageTitle, SafetyNote } from "@/components/shell";
import { TagRow } from "@/components/snapshot-view";
import { Button } from "@/components/ui/button";
import { exportMatrixCsv } from "@/lib/export";
import { ENGINE_TAB, formatOppScore, formatQualityScore, formatXScore } from "@/lib/format";
import { rankCompanies } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/cross")({ component: CrossPage });

function CrossPage() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const rows = rankCompanies(companies, snapshots);
  return (
    <>
      <PageTitle
        kicker="Cross-Strategy"
        title="매트릭스"
        action={
          <Button variant="secondary" onClick={() => exportMatrixCsv(companies, snapshots)}>
            CSV
          </Button>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        세 점수를 나란히 둡니다. Research Priority는 조사 순서일 뿐 투자 등급이 아닙니다.
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="idt-table w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className={FREEZE_COL}>종목</th>
              <th className="px-3 py-3 text-right">{ENGINE_TAB.xbagger.name}</th>
              <th className="px-3 py-3">10x</th>
              <th className="px-3 py-3 text-right">{ENGINE_TAB.oversold.name}</th>
              <th className="px-3 py-3 text-right">Value Trap</th>
              <th className="px-3 py-3 text-right">{ENGINE_TAB.quality.name}</th>
              <th className="px-3 py-3">Guru</th>
              <th className="px-3 py-3 text-right">Cov</th>
              <th className="px-3 py-3">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-muted" colSpan={9}>
                  아직 엔진 결과가 없습니다. 점수를 시드하지 않습니다.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.company.id}>
                <td className={FREEZE_COL}>
                  <CompanyTicker ticker={r.company.ticker} name={r.company.companyName} />
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatXScore(r.snapshot.xbagger.adjustedScore)} {r.snapshot.xbagger.grade}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{r.snapshot.xbagger.tenxFeasibility}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatOppScore(r.snapshot.oversold.opportunity)}
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">{r.snapshot.oversold.valueTrap} / 10</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  {formatQualityScore(r.snapshot.quality.score)} {r.snapshot.quality.grade}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-muted">
                  {r.snapshot.lenses.filter((l) => l.verdict === "PASS").length}P/
                  {r.snapshot.lenses.filter((l) => l.verdict === "FAIL").length}F
                </td>
                <td className="px-3 py-3 text-right font-mono">{Math.round(r.snapshot.overallCoverage * 100)}%</td>
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
