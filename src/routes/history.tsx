import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageTitle, SafetyNote } from "@/components/shell";
import { GradeBadge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/input";
import { displayTicker, formatDate } from "@/lib/format";
import { latestAnalysis, useAppStore } from "@/lib/store";
import { FACTOR_ORDER } from "@/lib/scoring/config";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const companies = useAppStore((s) => s.companies);
  const analyses = useAppStore((s) => s.analyses);
  const [id, setId] = useState(companies[0]?.id ?? "");
  const company = companies.find((c) => c.id === id) ?? companies[0];
  const series = useMemo(() => {
    if (!company) return [];
    return analyses
      .filter((a) => a.companyId === company.id)
      .sort((a, b) => a.analysisDate.localeCompare(b.analysisDate));
  }, [analyses, company]);

  const latest = company ? latestAnalysis(analyses, company.id) : undefined;
  const prev = series.length >= 2 ? series[series.length - 2] : undefined;
  const deltas =
    latest && prev
      ? FACTOR_ORDER.map((code) => {
          const a = latest.factorScores.find((f) => f.factorCode === code);
          const b = prev.factorScores.find((f) => f.factorCode === code);
          const av = a ? (a.overrideScore ?? a.score ?? 0) : 0;
          const bv = b ? (b.overrideScore ?? b.score ?? 0) : 0;
          return av !== bv ? { code, from: bv, to: av } : null;
        }).filter(Boolean)
      : [];

  const chartData = series.map((a) => ({
    date: formatDate(a.analysisDate),
    score: a.adjustedScore,
  }));

  return (
    <>
      <PageTitle kicker="History" title="분석 이력" />
      <p className="mb-4 text-sm text-muted">과거 분석은 덮어쓰지 않습니다.</p>

      <NativeSelect
        className="mb-6 max-w-md"
        value={company?.id ?? ""}
        onChange={(e) => setId(e.target.value)}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {displayTicker(c.ticker)} · {c.companyName}
          </option>
        ))}
      </NativeSelect>

      {chartData.length >= 2 ? (
        <div className="mb-6 h-56 rounded-[var(--radius-lg)] bg-surface p-3 shadow-[var(--shadow-border)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(236,232,220,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke="#6f6c64" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#6f6c64" fontSize={11} width={32} />
              <Tooltip
                contentStyle={{
                  background: "#1c1e18",
                  border: "1px solid #2a2c26",
                  borderRadius: 8,
                  color: "#ece8dc",
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8b9480"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ece8dc" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted">차트를 그리려면 같은 종목의 분석이 2건 이상 필요합니다.</p>
      )}

      {deltas.length ? (
        <ul className="mb-6 space-y-1 text-sm">
          {deltas.map((d) =>
            d ? (
              <li key={d.code} className="font-mono text-muted">
                {d.code} {d.from} → {d.to}
              </li>
            ) : null,
          )}
        </ul>
      ) : null}

      <ul className="space-y-2">
        {[...series].reverse().map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-[var(--radius-md)] bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
          >
            <div>
              <p className="font-mono text-sm tabular-nums">{formatDate(a.analysisDate)}</p>
              <p className="text-xs text-subtle">{a.scoringVersion}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg tabular-nums">{Math.round(a.adjustedScore)}</span>
              <GradeBadge grade={a.grade} />
            </div>
          </li>
        ))}
      </ul>

      {company ? (
        <Link
          to="/company/$ticker"
          params={{ ticker: encodeURIComponent(company.ticker) }}
          className="mt-6 inline-block text-sm text-sage"
        >
          {displayTicker(company.ticker)} 상세
        </Link>
      ) : null}
      <SafetyNote />
    </>
  );
}
