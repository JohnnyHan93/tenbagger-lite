import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { GradeBadge } from "@/components/ui/badge";
import { displayTicker } from "@/lib/format";
import { latestSnapshot, useAppStore } from "@/lib/store";

export const Route = createFileRoute("/watchlist")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const watchlist = useAppStore((s) => s.watchlist);
  const rows = companies.filter((c) => watchlist.includes(c.id));
  return (
    <>
      <PageTitle kicker="Watch" title="워치리스트" />
      <div className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted">비어 있습니다.</p> : null}
        {rows.map((c) => {
          const s = latestSnapshot(snapshots, c.id);
          return (
            <Link
              key={c.id}
              to="/company/$ticker"
              params={{ ticker: encodeURIComponent(c.ticker) }}
              className="flex items-center justify-between rounded-[var(--radius-md)] bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
            >
              <div>
                <p className="font-mono text-sage">{displayTicker(c.ticker)}</p>
                <p className="text-xs text-muted">{c.companyName}</p>
              </div>
              {s ? <GradeBadge grade={s.xbagger.grade} /> : null}
            </Link>
          );
        })}
      </div>
      <SafetyNote />
    </>
  );
}
