import { buildResearchGaps, highestImpactGap } from "@/lib/research/gaps";
import type { Snapshot } from "@/lib/domain/snapshot";
import type { Company } from "@/lib/types";

export function ResearchRequiredPanel({
  snapshot,
  company,
}: {
  snapshot: Snapshot;
  company: Company;
}) {
  const gap = highestImpactGap(snapshot, company);
  const missingX = snapshot.xbagger.factors.filter((f) => f.score == null).length;
  const missingQ = snapshot.quality.factors.filter((f) => f.status === "NA" && f.kind === "Core").length;
  return (
    <section className="mt-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Research Required</p>
      <p className="mt-2 text-sm text-muted">
        Coverage {Math.round(snapshot.overallCoverage * 100)}% · Confidence {snapshot.overallConfidence}
        {snapshot.statementBasis ? ` · ${snapshot.statementBasis}` : ""}
        {snapshot.fiscalYear ? ` · FY${snapshot.fiscalYear}` : ""}
      </p>
      <p className="mt-1 text-sm">
        비어 있는 X-Bagger {missingX} · Quality Core N/A {missingQ}. 점수를 채우지 않고 다음 조사를 표시한다.
      </p>
      {gap ? (
        <p className="mt-3 text-sm">
          <span className="font-mono text-xs text-sage">NEXT RESEARCH</span>{" "}
          {gap.field} · 영향 {gap.impact} · {gap.nextSource}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">우선 갭 없음.</p>
      )}
      {snapshot.sourceAttempts && snapshot.sourceAttempts.length > 0 ? (
        <ul className="mt-3 space-y-1 font-mono text-[0.6875rem] text-muted">
          {snapshot.sourceAttempts.map((a, i) => (
            <li key={`${a.provider}-${i}`}>
              {a.provider} · {a.status}
              {a.notes ? ` · ${a.notes}` : ""}
              {a.errorType ? ` · ${a.errorType}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-subtle">이 스냅샷에는 provider 로그가 없습니다. Refresh 시 기록됩니다.</p>
      )}
    </section>
  );
}

export function ResearchGapsList({ snapshot, company }: { snapshot: Snapshot; company: Company }) {
  const gaps = buildResearchGaps(snapshot, company);
  if (gaps.length === 0) return <p className="text-sm text-muted">표시할 조사 갭이 없습니다.</p>;
  return (
    <ol className="space-y-2">
      {gaps.map((g) => (
        <li key={`${g.engine}-${g.factor}-${g.rank}`} className="rounded-[var(--radius-md)] bg-surface p-3 shadow-[var(--shadow-border)]">
          <p className="font-mono text-xs text-sage">
            {g.rank}. {g.impact} · {g.engine} {g.factor}
          </p>
          <p className="mt-1 text-sm">{g.field}</p>
          <p className="mt-1 text-xs text-muted">{g.reason}</p>
          <p className="mt-1 text-xs text-subtle">다음 출처: {g.nextSource}</p>
        </li>
      ))}
    </ol>
  );
}
