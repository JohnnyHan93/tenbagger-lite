import { Link } from "@tanstack/react-router";
import { GradeBadge, FeasibilityBadge, FlagBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Snapshot } from "@/lib/domain/snapshot";
import {
  ENGINE_TAB,
  formatFactor10,
  formatMoney,
  formatOppScore,
  formatPct,
  formatPrice,
  formatQualityScore,
  formatXScore,
} from "@/lib/format";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SnapshotHeader({
  company,
  snapshot,
}: {
  company: Company;
  snapshot: Snapshot;
}) {
  return (
    <section className="rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-sage">
            {company.ticker}
            {company.sample ? " · SAMPLE" : ""}
          </p>
          <h2 className="masthead mt-1 text-2xl md:text-3xl">{company.companyName}</h2>
          <p className="mt-1 text-sm text-muted">
            {company.exchange} · {company.country} · {company.sector}
            {snapshot.industryAdapter ? ` · Adapter ${snapshot.industryAdapter}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[0.625rem] tracking-widest text-subtle uppercase">Coverage</p>
          <p className="font-mono text-xl tabular-nums">{Math.round(snapshot.overallCoverage * 100)}%</p>
          <p className="text-xs text-muted">{snapshot.overallConfidence}</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Price" value={formatPrice(snapshot.price, snapshot.currency)} />
        <Stat label="Market Cap" value={formatMoney(snapshot.marketCap, snapshot.currency)} />
        <Stat label="EV" value={formatMoney(snapshot.enterpriseValue, snapshot.currency)} />
        <Stat label="As-of" value={snapshot.asOf.slice(0, 10)} />
      </div>
      {company.sample ? (
        <p className="mt-4 text-xs text-flag-yellow">SAMPLE FIXTURE — 실전 분석이 아닙니다.</p>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] tracking-widest text-subtle uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg tabular-nums md:text-xl">{value}</p>
    </div>
  );
}

export function EngineTrio({
  snapshot,
  ticker,
  onPick,
}: {
  snapshot: Snapshot;
  ticker: string;
  onPick?: (id: "x" | "o" | "q") => void;
}) {
  const x = snapshot.xbagger;
  const o = snapshot.oversold;
  const q = snapshot.quality;
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      <EngineCard
        kicker={`${ENGINE_TAB.xbagger.name} · ${x.version ?? ENGINE_TAB.xbagger.version}`}
        title={formatXScore(x.adjustedScore)}
        sub={`Grade ${x.grade} · ${x.verdict}`}
        status={x.status}
        ticker={ticker}
        onPick={onPick ? () => onPick("x") : undefined}
      >
        <p className="font-mono text-[0.625rem] tracking-wide text-subtle">10 factors × 0–10, weighted 0–100</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <GradeBadge grade={x.grade} />
          <FeasibilityBadge value={x.tenxFeasibility} />
        </div>
        <p className="mt-3 font-mono text-xs text-muted">
          10x {x.gates.tenx} · Survival {x.gates.survival} · Coverage {Math.round(x.coverage * 100)}%
        </p>
      </EngineCard>
      <EngineCard
        kicker={`${ENGINE_TAB.oversold.name} · ${o.version ?? ENGINE_TAB.oversold.version}`}
        title={formatOppScore(o.opportunity)}
        sub={`Case ${o.case} · Value Trap ${o.valueTrap} / 10`}
        status={o.status}
        ticker={ticker}
        onPick={onPick ? () => onPick("o") : undefined}
      >
        <p className="font-mono text-[0.625rem] tracking-wide text-subtle">
          Opp = 0.40F + 0.25V + 0.10O + 0.25R
        </p>
        <p className="mt-2 font-mono text-xs text-muted">
          F {formatFactor10(o.fundamental)} · V {formatFactor10(o.valuation)} · O {formatFactor10(o.oversold)} · R{" "}
          {formatFactor10(o.riskInverse)}
        </p>
        {o.valueTrap >= 7 ? (
          <p className="mt-2 text-xs text-grade-d">Value Trap {o.valueTrap} / 10 — 합산하지 않음</p>
        ) : null}
        {o.peakEarnings ? <p className="mt-2 text-xs text-flag-yellow">Peak earnings flag</p> : null}
      </EngineCard>
      <EngineCard
        kicker={`${ENGINE_TAB.quality.name} · ${q.version ?? ENGINE_TAB.quality.version}`}
        title={formatQualityScore(q.score)}
        sub={`Grade ${q.grade} · ${q.scoredCount}/${q.eligibleCount} scored`}
        status={q.status}
        ticker={ticker}
        onPick={onPick ? () => onPick("q") : undefined}
      >
        <p className="font-mono text-[0.625rem] tracking-wide text-subtle">70 factors × 0–10 · N/A ≠ 0</p>
        <div className="mt-2">
          <FlagBadge status={q.redFlag === "UNKNOWN" ? "YELLOW" : q.redFlag} />
        </div>
        <p className="mt-3 font-mono text-xs text-muted">
          Diagnostic 미합산 · Coverage {Math.round(q.coverage * 100)}%
        </p>
      </EngineCard>
    </div>
  );
}

function EngineCard({
  kicker,
  title,
  sub,
  status,
  ticker,
  onPick,
  children,
}: {
  kicker: string;
  title: string;
  sub: string;
  status: string;
  ticker: string;
  onPick?: () => void;
  children: React.ReactNode;
}) {
  const className =
    "block w-full rounded-[var(--radius-lg)] bg-surface p-4 text-left shadow-[var(--shadow-border)] transition-colors hover:bg-elevated";
  const inner = (
    <>
      <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">{kicker}</p>
      <p className="masthead mt-1 text-3xl tabular-nums">{title}</p>
      <p className="mt-1 text-sm text-muted">{sub}</p>
      <p className="mt-1 font-mono text-[0.625rem] text-subtle">{status}</p>
      <div className="mt-3">{children}</div>
    </>
  );
  if (onPick) {
    return (
      <button type="button" onClick={onPick} className={className}>
        {inner}
      </button>
    );
  }
  return (
    <Link to="/company/$ticker" params={{ ticker: encodeURIComponent(ticker) }} className={className}>
      {inner}
    </Link>
  );
}

export function FactorRows({
  rows,
}: {
  rows: Array<{
    id: string;
    name: string;
    score: number | null;
    weight?: number;
    coverage?: number;
    confidence?: string;
    reason: string;
    status?: string;
  }>;
}) {
  const showWeight = rows.some((r) => r.weight != null);
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
          <tr>
            <th className="px-3 py-2">Factor</th>
            <th className="px-3 py-2 text-right">Score 0–10</th>
            {showWeight ? <th className="hidden px-3 py-2 text-right md:table-cell">Weight</th> : null}
            <th className="hidden px-3 py-2 md:table-cell">Why</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2">
                <p className="font-mono text-xs text-sage">{r.id}</p>
                <p>{r.name}</p>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{formatFactor10(r.score)}</td>
              {showWeight ? (
                <td className="hidden px-3 py-2 text-right font-mono text-xs text-muted md:table-cell">
                  {r.weight ?? "—"}
                </td>
              ) : null}
              <td className="hidden px-3 py-2 text-xs text-muted md:table-cell">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span
          key={t}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-2.5 font-mono text-[0.6875rem] tracking-wide",
            t.includes("TRAP") || t === "NO EDGE"
              ? "bg-grade-d/15 text-grade-d"
              : t === "RESEARCH REQUIRED"
                ? "bg-flag-yellow/15 text-flag-yellow"
                : "bg-elevated text-muted",
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function SnapshotActions({
  onWatch,
  watching,
  children,
}: {
  onWatch: () => void;
  watching: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={watching ? "secondary" : "primary"} onClick={onWatch}>
        {watching ? "워치 해제" : "워치"}
      </Button>
      {children}
    </div>
  );
}

export function TenxBlock({ snapshot }: { snapshot: Snapshot }) {
  const m = snapshot.tenxMath;
  if (!m) return <p className="text-sm text-muted">10x math 없음</p>;
  return (
    <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">10x Math</p>
      <p className="mt-2 text-sm text-muted">
        Target {formatMoney(m.targetMarketCap, snapshot.currency)} · path {m.path} · CAGR {formatPct(m.assumedCagr, 0)}
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {snapshot.tenxScenarios.map((s) => (
          <div key={s.scenario} className="rounded-[var(--radius-md)] bg-elevated p-3">
            <p className="font-mono text-xs text-sage">{s.scenario}</p>
            <p className="font-mono text-lg tabular-nums">{s.upsideMultiple.toFixed(1)}x</p>
            <p className="text-xs text-muted">{formatMoney(s.revenue, snapshot.currency)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
