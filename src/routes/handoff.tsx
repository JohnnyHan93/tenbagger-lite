import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { GradeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { displayTicker, formatDate } from "@/lib/format";
import { latestAnalysis, useAppStore } from "@/lib/store";
import type { HandoffStatus } from "@/lib/scoring/config";

export const Route = createFileRoute("/handoff")({ component: HandoffPage });

const STATUSES: HandoffStatus[] = ["NOT SENT", "READY", "IN REVIEW", "MASTER COMPLETE"];

function HandoffPage() {
  const companies = useAppStore((s) => s.companies);
  const analyses = useAppStore((s) => s.analyses);
  const handoffs = useAppStore((s) => s.handoffs);
  const setHandoff = useAppStore((s) => s.setHandoff);

  const aNames = companies
    .map((c) => ({ company: c, analysis: latestAnalysis(analyses, c.id) }))
    .filter((x): x is typeof x & { analysis: NonNullable<typeof x.analysis> } =>
      Boolean(x.analysis && x.analysis.grade === "A"),
    );

  return (
    <>
      <PageTitle kicker="Master" title="Master Handoff" />
      <p className="mb-6 max-w-xl text-sm text-muted">
        A등급만 후보로 올라옵니다. SEND TO MASTER를 눌러야 상태가 바뀝니다. Lite 점수를 Master
        점수로 변환하지 않습니다.
      </p>

      {aNames.length === 0 ? (
        <p className="text-sm text-muted">현재 A등급 후보가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {aNames.map(({ company, analysis }) => {
            const h = handoffs.find((x) => x.companyId === company.id);
            const status = h?.status ?? "NOT SENT";
            return (
              <li
                key={company.id}
                className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <Link
                    to="/company/$ticker"
                    params={{ ticker: encodeURIComponent(company.ticker) }}
                    className="font-mono text-sm text-sage"
                  >
                    {displayTicker(company.ticker)}
                  </Link>
                  <p className="text-base">{company.companyName}</p>
                  <p className="mt-1 flex items-center gap-2 font-mono text-xs text-muted">
                    <GradeBadge grade={analysis.grade} />
                    {Math.round(analysis.adjustedScore)} · {formatDate(analysis.analysisDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    className="w-44"
                    value={status}
                    onChange={(e) =>
                      setHandoff(company.id, analysis.id, e.target.value as HandoffStatus)
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </NativeSelect>
                  {status === "NOT SENT" ? (
                    <Button
                      size="sm"
                      onClick={() => setHandoff(company.id, analysis.id, "READY")}
                    >
                      SEND TO MASTER
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <SafetyNote />
    </>
  );
}
