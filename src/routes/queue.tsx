import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { buildQueue } from "@/lib/engines/run";
import { displayTicker } from "@/lib/format";
import { latestSnapshot, useAppStore } from "@/lib/store";

export const Route = createFileRoute("/queue")({ component: Page });

function Page() {
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const latest = companies
    .map((c) => latestSnapshot(snapshots, c.id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const items = buildQueue(latest).map((it) => {
    const c = companies.find((x) => x.id === it.companyId);
    return { ...it, ticker: c?.ticker ?? "" };
  });
  return (
    <>
      <PageTitle kicker="Research Queue" title="조사 큐" />
      <p className="mb-4 text-sm text-muted">커버리지가 낮거나 게이트에 가까운 빈 칸을 먼저 채웁니다.</p>
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            <tr>
              <th className="px-3 py-3">Pri</th>
              <th className="px-3 py-3">Ticker</th>
              <th className="px-3 py-3">Engine</th>
              <th className="px-3 py-3">Factor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.slice(0, 40).map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2 font-mono text-xs">{it.priority}</td>
                <td className="px-3 py-2">
                  {it.ticker ? (
                    <Link
                      to="/company/$ticker"
                      params={{ ticker: encodeURIComponent(it.ticker) }}
                      className="font-mono text-sage"
                    >
                      {displayTicker(it.ticker)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{it.engine}</td>
                <td className="px-3 py-2">
                  <p className="font-mono text-xs">{it.factor}</p>
                  <p className="text-xs text-subtle">{it.reason}</p>
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
