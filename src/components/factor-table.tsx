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
      <ul className="divide-y divide-border">
        {FACTOR_ORDER.map((code) => {
          const s = by.get(code);
          const score = s ? (s.overrideScore ?? s.score) : 0;
          const overridden = s?.overrideScore != null;
          return (
            <li key={code}>
              <button
                type="button"
                onClick={() => onSelect?.(code)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-elevated/60"
              >
                <span className="w-8 shrink-0 font-mono text-xs text-subtle">{code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg">{FACTOR_META[code].nameKo}</span>
                  <span className="block truncate text-xs text-muted">
                    {s?.evidenceSummary}
                    {overridden ? " · override" : ""}
                  </span>
                </span>
                <ScorePips score={score} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ScorePips({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${score} / 2`}>
      {[0, 1].map((i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full",
            i < score ? "bg-sage" : "bg-border-strong",
          )}
        />
      ))}
      <span className="ml-1 w-6 text-right font-mono text-xs tabular-nums text-muted">
        {score}/2
      </span>
    </span>
  );
}
