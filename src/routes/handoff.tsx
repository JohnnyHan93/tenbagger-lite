import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { displayTicker } from "@/lib/format";
import { rankCompanies } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/handoff")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const rows = rankCompanies(companies, snapshots).filter(
    (r) => r.snapshot.xbagger.adjustedScore >= 65 && r.snapshot.xbagger.grade !== "F",
  );
  return (
    <>
      <PageTitle kicker="Deep Validation" title="Master 후보" />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Lite Discovery Score와 Master 100pt는 별개입니다. 여기서는 게이트를 통과한 후보만 모읍니다.
      </p>
      {rows.length === 0 ? <p className="text-sm text-muted">아직 Deep Validation 후보가 없습니다.</p> : null}
      <div className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.company.id}
            to="/company/$ticker"
            params={{ ticker: encodeURIComponent(r.company.ticker) }}
            className="block rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-border)]"
          >
            <p className="font-mono text-sage">{displayTicker(r.company.ticker)}</p>
            <p className="text-sm">{r.company.companyName}</p>
            <p className="mt-1 font-mono text-xs text-muted">
              Discovery {Math.round(r.snapshot.xbagger.adjustedScore)} · 10x {r.snapshot.xbagger.tenxFeasibility} ·{" "}
              {r.snapshot.oneSentenceThesis}
            </p>
          </Link>
        ))}
      </div>
      <SafetyNote />
    </>
  );
}
