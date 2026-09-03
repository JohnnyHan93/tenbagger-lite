import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RankingList } from "@/components/ranking";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { exportWatchlistCsv, exportWatchlistXls } from "@/lib/export";
import { rankCompanies, type RankRow } from "@/lib/selectors";
import { useAppStore } from "@/lib/store";
import type { Grade, TenxFeasibility } from "@/lib/scoring/config";

export const Route = createFileRoute("/watchlist")({ component: WatchlistPage });

function WatchlistPage() {
  const companies = useAppStore((s) => s.companies);
  const analyses = useAppStore((s) => s.analyses);
  const watchlist = useAppStore((s) => s.watchlist);
  const [grade, setGrade] = useState<Grade | "ALL">("ALL");
  const [tenx, setTenx] = useState<TenxFeasibility | "ALL">("ALL");
  const [country, setCountry] = useState("ALL");
  const [sort, setSort] = useState<"score" | "change" | "newest">("score");

  const watched = companies.filter((c) => watchlist.includes(c.id));
  const countries = [...new Set(watched.map((c) => c.country).filter(Boolean))];

  const rows = useMemo(() => {
    let list: RankRow[] = rankCompanies(watched, analyses);
    if (grade !== "ALL") list = list.filter((r) => r.analysis.grade === grade);
    if (tenx !== "ALL") list = list.filter((r) => r.analysis.tenxFeasibility === tenx);
    if (country !== "ALL") list = list.filter((r) => r.company.country === country);
    if (sort === "change") {
      list = [...list].sort((a, b) => (b.change ?? -999) - (a.change ?? -999));
    } else if (sort === "newest") {
      list = [...list].sort((a, b) =>
        b.analysis.analysisDate.localeCompare(a.analysis.analysisDate),
      );
    }
    return list.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [watched, analyses, grade, tenx, country, sort]);

  return (
    <>
      <PageTitle
        kicker="Watchlist"
        title="관심 종목"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportWatchlistCsv(watched, analyses)}
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportWatchlistXls(watched, analyses)}
            >
              Excel
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <NativeSelect value={grade} onChange={(e) => setGrade(e.target.value as Grade | "ALL")}>
          <option value="ALL">Grade 전체</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="D">D</option>
        </NativeSelect>
        <NativeSelect
          value={tenx}
          onChange={(e) => setTenx(e.target.value as TenxFeasibility | "ALL")}
        >
          <option value="ALL">10x 전체</option>
          <option value="HIGH">HIGH</option>
          <option value="POSSIBLE">POSSIBLE</option>
          <option value="LOW">LOW</option>
          <option value="UNREALISTIC">UNREALISTIC</option>
        </NativeSelect>
        <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="ALL">국가 전체</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="score">점수순</option>
          <option value="change">변화순</option>
          <option value="newest">최신순</option>
        </NativeSelect>
      </div>

      <RankingList rows={rows} />
      <SafetyNote />
    </>
  );
}
