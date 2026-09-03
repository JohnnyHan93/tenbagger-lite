import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RankingList } from "@/components/ranking";
import { SummaryChips } from "@/components/score-card";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { dashboardStats, rankCompanies } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const companies = useAppStore((s) => s.companies);
  const analyses = useAppStore((s) => s.analyses);
  const stats = dashboardStats(companies, analyses);
  const [cohort, setCohort] = useState<"all" | "priority" | "conditional">("all");
  const filtered = useMemo(() => {
    if (cohort === "all") return companies;
    return companies.filter((c) => c.cohort === cohort);
  }, [companies, cohort]);
  const rows = rankCompanies(filtered, analyses);

  return (
    <>
      <PageTitle
        kicker="Wildcard 5% Discovery Terminal"
        title="레이더"
        action={
          <Link to="/analyze">
            <Button>티커 분석</Button>
          </Link>
        }
      />

      <SummaryChips
        items={[
          { label: "S/A Candidates", value: stats.aCount },
          { label: "B Watchlist", value: stats.bCount },
          { label: "Library", value: stats.total },
          { label: "Need Refresh", value: stats.refresh },
        ]}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["all", "전체"],
            ["priority", "우선 20"],
            ["conditional", "조건부 20"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCohort(id)}
            className={
              cohort === id
                ? "h-9 rounded-[var(--radius-md)] bg-accent px-3 font-mono text-xs text-accent-fg"
                : "h-9 rounded-[var(--radius-md)] bg-elevated px-3 font-mono text-xs text-muted"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <h2 className="mb-3 font-mono text-xs tracking-widest text-muted uppercase">
          Ranking
        </h2>
        <RankingList rows={rows} />
      </div>

      <SafetyNote />
    </>
  );
}
