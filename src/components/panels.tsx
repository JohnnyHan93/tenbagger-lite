import { FlagBadge } from "@/components/ui/badge";
import { formatMoney, formatMultiple, formatPct } from "@/lib/format";
import type { Analysis, Evidence, RedFlag, TenxScenario } from "@/lib/types";
import type { Currency } from "@/lib/types";

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
          <p className="mt-2 font-mono text-[0.6875rem] text-subtle">
            {f.hardStop ? "HARD STOP" : `penalty −${f.penalty}`}
          </p>
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
  return (
    <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="masthead text-xl">10x Math</h3>
        <p className="font-mono text-xs text-muted">
          Target {formatMoney(analysis.marketCap * 10, analysis.currency)}
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
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
