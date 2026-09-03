import { Link, createFileRoute } from "@tanstack/react-router";
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
  const rows = rankCompanies(companies, analyses);

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
          { label: "New Evidence", value: stats.newEvidence },
          { label: "Need Refresh", value: stats.refresh },
        ]}
      />

      <div className="mt-6">
        <h2 className="mb-3 font-mono text-xs tracking-widest text-muted uppercase">
          Ranking
        </h2>
        <RankingList rows={rows} />
      </div>

      <SafetyNote />
    </>
  );
}
