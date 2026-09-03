import { FlagBadge } from "@/components/ui/badge";
import { formatMoney, formatMultiple, formatPct } from "@/lib/format";
import type { Analysis, Evidence, HardGates, RedFlag, TenxScenario } from "@/lib/types";
import type { Currency } from "@/lib/types";
import type { GateResult } from "@/lib/scoring/config";
import { cn } from "@/lib/utils";

export function HardGatePanel({ gates }: { gates: HardGates }) {
  const rows: Array<{ key: string; label: string; value: GateResult }> = [
    { key: "tenx", label: "10x Math ≥ 6", value: gates.tenx },
    { key: "survival", label: "Survival ≥ 4", value: gates.survival },
    { key: "customer", label: "Customer ≥ 4", value: gates.customer },
    { key: "evidence", label: "Evidence quality", value: gates.evidence },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {rows.map((r) => (
        <article
          key={r.key}
          className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]"
        >
          <h3 className="font-mono text-[0.625rem] tracking-widest text-muted uppercase">
            {r.label}
          </h3>
          <p
            className={cn(
              "mt-2 font-mono text-sm",
              r.value === "PASS" && "text-grade-a",
              r.value === "FAIL" && "text-grade-d",
              (r.value === "WATCHLIST" || r.value === "RESEARCH REQUIRED") && "text-grade-c",
            )}
          >
            {r.value}
          </p>
        </article>
      ))}
    </div>
  );
}

export function RedFlagPanel({ flags }: { flags: RedFlag[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {flags.map((f) => (
        <article
          key={f.flagType}
          className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-mono text-xs tracking-widest text-muted">{f.flagType}</h3>
            <FlagBadge status={f.status} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-fg">{f.reason}</p>
        </article>
      ))}
    </div>
  );
}

export function TenxMathPanel({
  analysis,
}: {
  analysis: Analysis;
}) {
  const m = analysis.tenxMath;
  return (
    <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="masthead text-xl">10x Math</h3>
        <p className="font-mono text-xs text-muted">
          Path {m?.path ?? "—"} · Target {formatMoney(analysis.marketCap * 10, analysis.currency)}
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <KV k="Current mcap" v={formatMoney(m?.currentMarketCap ?? analysis.marketCap, analysis.currency)} />
        <KV k="10x target" v={formatMoney(m?.targetMarketCap ?? analysis.marketCap * 10, analysis.currency)} />
        <KV k="Current rev" v={formatMoney(m?.currentRevenue, analysis.currency)} />
        <KV k="Assumed CAGR" v={formatPct(m?.assumedCagr)} />
        <KV k="5Y revenue" v={formatMoney(m?.revenue5y, analysis.currency)} />
        <KV k="7Y revenue" v={formatMoney(m?.revenue7y, analysis.currency)} />
        <KV k="Mature margin" v={formatPct(m?.matureMargin)} />
        <KV k="Exit multiple" v={formatMultiple(m?.exitMultiple)} />
        <KV k="Implied future" v={formatMoney(m?.impliedFutureMarketCap, analysis.currency)} />
        <KV k="vs today" v={formatMultiple(m?.impliedMultipleVsToday)} />
      </dl>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {analysis.tenxScenarios.map((s) => (
          <ScenarioCard key={s.scenario} s={s} currency={analysis.currency} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <KV k="Required Rev" v={formatMoney(analysis.requiredRevenue, analysis.currency)} />
        <KV k="Required NI" v={formatMoney(analysis.requiredNetIncome, analysis.currency)} />
        <KV k="Req. EV/S" v={formatMultiple(analysis.requiredEvSales)} />
        <KV k="Req. P/E" v={formatMultiple(analysis.requiredPe)} />
      </dl>
    </div>
  );
}

function ScenarioCard({ s, currency }: { s: TenxScenario; currency: Currency }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-elevated p-3">
      <p className="font-mono text-[0.625rem] tracking-widest text-sage">{s.scenario}</p>
      <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
        <KV k="Revenue" v={formatMoney(s.revenue, currency)} />
        <KV k="Op. margin" v={formatPct(s.operatingMargin)} />
        <KV k="Net margin" v={formatPct(s.netMargin)} />
        <KV k="Net income" v={formatMoney(s.netIncome, currency)} />
        <KV k={s.multipleType} v={formatMultiple(s.multipleValue)} />
        <KV k="Implied" v={formatMoney(s.impliedMarketCap, currency)} />
        <KV k="Upside" v={formatMultiple(s.upsideMultiple)} />
      </dl>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.625rem] tracking-wide text-subtle uppercase">{k}</dt>
      <dd className="font-mono text-sm tabular-nums text-fg">{v}</dd>
    </div>
  );
}

export function ThesisCard({ text, gate }: { text: string; gate: "PASS" | "FAIL" }) {
  return (
    <blockquote className="rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">
        One-sentence thesis · Gate {gate}
      </p>
      <p className="masthead mt-3 text-lg leading-snug text-fg md:text-xl">{text}</p>
    </blockquote>
  );
}

export function BulletList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">{title}</h3>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function EvidenceTable({ items }: { items: Evidence[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted">저장된 증거가 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-border font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
          <tr>
            <th className="px-3 py-2">Factor</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2 font-mono text-xs text-muted">{e.factorCode}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{e.evidenceType}</td>
              <td className="px-3 py-2">{e.evidence}</td>
              <td className="px-3 py-2">
                {e.sourceUrl ? (
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sage underline-offset-2 hover:underline"
                  >
                    {e.sourceName || e.sourceUrl}
                  </a>
                ) : (
                  <span className="text-muted">{e.sourceName || "—"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
