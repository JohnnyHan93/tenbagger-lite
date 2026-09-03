import { FACTOR_META, FACTOR_ORDER, type FactorCode } from "@/lib/scoring/config";
import type { FactorScore } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FactorTable({
  scores,
  onSelect,
}: {
  scores: FactorScore[];
  onSelect?: (code: FactorCode) => void;
}) {
  const by = new Map(scores.map((s) => [s.factorCode, s]));
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
      <div className="hidden grid-cols-[3rem_1fr_3.5rem_3rem_4rem_4rem] gap-2 border-b border-border px-4 py-2 font-mono text-[0.625rem] tracking-widest text-subtle uppercase md:grid">
        <span>ID</span>
        <span>Factor</span>
        <span className="text-right">Raw</span>
        <span className="text-right">Wt</span>
        <span className="text-right">Wtd</span>
        <span className="text-right">Conf</span>
      </div>
      <ul className="divide-y divide-border">
        {FACTOR_ORDER.map((code) => {
          const s = by.get(code);
          const score = s ? (s.overrideScore ?? s.score) : null;
          const overridden = s?.overrideScore != null;
          const wtd = s?.weightedScore;
          return (
            <li key={code}>
              <button
                type="button"
                onClick={() => onSelect?.(code)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-elevated/60 md:grid md:grid-cols-[3rem_1fr_3.5rem_3rem_4rem_4rem] md:gap-2"
              >
                <span className="w-8 shrink-0 font-mono text-xs text-subtle md:w-auto">{code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg">{FACTOR_META[code].nameKo}</span>
                  <span className="block truncate text-xs text-muted">
                    {s?.found ? `발견 ${s.found}` : s?.evidenceSummary}
                    {s?.benchmark ? ` · ${s.benchmark}` : ""}
                    {overridden ? " · override" : ""}
                  </span>
                </span>
                <span className="hidden text-right font-mono text-sm tabular-nums md:block">
                  {score == null ? "N/A" : `${score}/10`}
                </span>
                <span className="hidden text-right font-mono text-xs text-muted md:block">
                  {s?.weight ?? FACTOR_META[code].weight}
                </span>
                <span className="hidden text-right font-mono text-sm tabular-nums md:block">
                  {wtd == null ? "—" : wtd.toFixed(1)}
                </span>
                <span className="hidden text-right font-mono text-[0.6875rem] text-subtle md:block">
                  {s?.confidence ?? ""}
                </span>
                <span className="md:hidden">
                  <ScorePips score={score} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ScorePips({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="font-mono text-xs text-subtle">N/A</span>;
  }
  return (
    <span className="flex items-center gap-1" aria-label={`${score} / 10`}>
      {[0, 2, 4, 6, 8].map((i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full",
            i < score ? "bg-sage" : "bg-border-strong",
          )}
        />
      ))}
      <span className="ml-1 w-8 text-right font-mono text-xs tabular-nums text-muted">
        {score}/10
      </span>
    </span>
  );
}
