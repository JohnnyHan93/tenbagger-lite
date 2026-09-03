import { FeasibilityBadge, GradeBadge } from "@/components/ui/badge";
import { formatMoney, formatPrice, formatScore } from "@/lib/format";
import type { Analysis, Company } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ScoreHero({
  company,
  analysis,
}: {
  company: Company;
  analysis: Analysis;
}) {
  return (
    <section className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-sage">{company.ticker}</p>
          <h2 className="masthead mt-1 text-2xl md:text-3xl">{company.companyName}</h2>
          <p className="mt-1 text-sm text-muted">
            {company.exchange} · {company.country} · {company.sector}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GradeBadge grade={analysis.grade} className="h-8 px-3 text-sm" />
          <FeasibilityBadge value={analysis.tenxFeasibility} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total" value={formatScore(analysis.adjustedScore)} accent />
        <Stat label="Raw Σ" value={`${analysis.factorTotal}/100`} />
        <Stat label="Price" value={formatPrice(analysis.price, analysis.currency)} />
        <Stat label="Market Cap" value={formatMoney(analysis.marketCap, analysis.currency)} />
      </div>

      <p className="mt-5 font-mono text-xs tracking-wide text-muted">
        {analysis.grade} — {analysis.verdict}
        {analysis.hardStop ? " · HARD STOP" : ""}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] tracking-widest text-subtle uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-xl tabular-nums md:text-2xl",
          accent ? "text-fg" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function SummaryChips({
  items,
}: {
  items: { label: string; value: number | string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-[var(--radius-lg)] bg-surface px-4 py-4 shadow-[var(--shadow-border)]"
        >
          <p className="font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
            {it.label}
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-fg">{it.value}</p>
        </div>
      ))}
    </div>
  );
}
