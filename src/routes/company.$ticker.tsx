import { Link, createFileRoute } from "@tanstack/react-router";
import { AnalysisView } from "@/components/analysis-view";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { exportAnalysisCsv, exportEvidenceCsv } from "@/lib/export";
import { displayTicker } from "@/lib/format";
import { latestAnalysis, previousAnalysis, useAppStore } from "@/lib/store";
import { FACTOR_ORDER } from "@/lib/scoring/config";

export const Route = createFileRoute("/company/$ticker")({
  component: CompanyPage,
});

function CompanyPage() {
  const { ticker } = Route.useParams();
  const decoded = decodeURIComponent(ticker);
  const companies = useAppStore((s) => s.companies);
  const analyses = useAppStore((s) => s.analyses);
  const watchlist = useAppStore((s) => s.watchlist);
  const toggleWatch = useAppStore((s) => s.toggleWatch);
  const setHandoff = useAppStore((s) => s.setHandoff);
  const handoffs = useAppStore((s) => s.handoffs);

  const company = companies.find(
    (c) => c.ticker.toUpperCase() === decoded.toUpperCase(),
  );
  if (!company) {
    return (
      <>
        <PageTitle title="종목을 찾을 수 없습니다" />
        <p className="text-sm text-muted">{decoded}</p>
        <Link to="/analyze" className="mt-4 inline-block text-sage">
          새로 분석하기
        </Link>
      </>
    );
  }

  const analysis = latestAnalysis(analyses, company.id);
  const prev = analysis ? previousAnalysis(analyses, company.id, analysis.id) : undefined;
  const watching = watchlist.includes(company.id);
  const handoff = handoffs.find((h) => h.companyId === company.id);

  const factorDelta =
    analysis && prev
      ? FACTOR_ORDER.map((code) => {
          const a = analysis.factorScores.find((f) => f.factorCode === code);
          const b = prev.factorScores.find((f) => f.factorCode === code);
          const av = a ? (a.overrideScore ?? a.score) : 0;
          const bv = b ? (b.overrideScore ?? b.score) : 0;
          return av !== bv ? { code, from: bv, to: av } : null;
        }).filter((x): x is { code: typeof FACTOR_ORDER[number]; from: number; to: number } => Boolean(x))
      : [];

  return (
    <>
      <PageTitle
        kicker={displayTicker(company.ticker)}
        title={company.companyName}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => toggleWatch(company.id)}>
              {watching ? "워치 해제" : "워치 추가"}
            </Button>
            {analysis ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportAnalysisCsv(company, analyses)}
                >
                  이력 CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportEvidenceCsv(company, analysis)}
                >
                  증거 CSV
                </Button>
              </>
            ) : null}
            <Link to="/analyze">
              <Button size="sm">Refresh</Button>
            </Link>
          </div>
        }
      />

      {analysis && prev ? (
        <p className="mb-4 font-mono text-sm text-muted">
          점수 {Math.round(prev.adjustedScore)} → {Math.round(analysis.adjustedScore)}
          {factorDelta.length
            ? " · " +
              factorDelta.map((d) => `${d.code} ${d.from}→${d.to}`).join(" · ")
            : ""}
        </p>
      ) : null}

      {analysis?.grade === "A" ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] bg-grade-a/10 px-4 py-3">
          <p className="text-sm text-grade-a">A — Master Deep Dive 후보</p>
          <Button
            size="sm"
            onClick={() => setHandoff(company.id, analysis.id, "READY")}
          >
            SEND TO MASTER
          </Button>
          <span className="font-mono text-xs text-muted">
            {handoff?.status ?? "NOT SENT"}
          </span>
        </div>
      ) : null}

      {analysis ? (
        <AnalysisView company={company} analysis={analysis} />
      ) : (
        <p className="text-sm text-muted">아직 분석이 없습니다.</p>
      )}
      <SafetyNote />
    </>
  );
}
