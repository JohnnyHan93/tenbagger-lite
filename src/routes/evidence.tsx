import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { displayTicker } from "@/lib/format";
import { latestSnapshot, useAppStore } from "@/lib/store";

export const Route = createFileRoute("/evidence")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const rows = companies.flatMap((c) => {
    const s = latestSnapshot(snapshots, c.id);
    if (!s) return [];
    return s.evidence.slice(0, 8).map((e) => ({ c, e }));
  });
  return (
    <>
      <PageTitle kicker="Evidence graph" title="증거" />
      <div className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted">증거가 없습니다.</p> : null}
        {rows.map(({ c, e }) => (
          <div key={e.id} className="rounded-[var(--radius-md)] bg-surface p-3 shadow-[var(--shadow-border)]">
            <p className="font-mono text-xs text-sage">
              <Link to="/company/$ticker" params={{ ticker: encodeURIComponent(c.ticker) }}>
                {displayTicker(c.ticker)}
              </Link>{" "}
              · {e.factorCode} · {e.evidenceType}
            </p>
            <p className="mt-1 text-sm">{e.evidence}</p>
            <p className="mt-1 text-xs text-subtle">
              {e.sourceName} · {e.sourceDate}
            </p>
          </div>
        ))}
      </div>
      <SafetyNote />
    </>
  );
}
