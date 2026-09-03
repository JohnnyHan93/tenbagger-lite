import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FactorTable } from "@/components/factor-table";
import {
  BulletList,
  EvidenceTable,
  HardGatePanel,
  RedFlagPanel,
  TenxMathPanel,
  ThesisCard,
} from "@/components/panels";
import { ScoreHero } from "@/components/score-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { FACTOR_META, type FactorCode } from "@/lib/scoring/config";
import type { Analysis, Company } from "@/lib/types";
import { useAppStore } from "@/lib/store";

export function AnalysisView({
  company,
  analysis,
}: {
  company: Company;
  analysis: Analysis;
}) {
  const overrideFactor = useAppStore((s) => s.overrideFactor);
  const [open, setOpen] = useState<FactorCode | null>(null);
  const [reason, setReason] = useState("");
  const [next, setNext] = useState(6);

  return (
    <div className="space-y-6">
      <ScoreHero company={company} analysis={analysis} />

      {(analysis.findings ?? []).length ? (
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {analysis.findings!.map((f) => (
            <div
              key={f.label}
              className="rounded-[var(--radius-md)] bg-elevated px-3 py-2"
            >
              <dt className="font-mono text-[0.625rem] tracking-widest text-subtle uppercase">
                {f.label}
              </dt>
              <dd className="mt-1 text-sm text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">
        각 팩터는 0/2/4/6/8/10점. 가중 합이 100점. Hard Gate가 등급보다 우선합니다.
        팩터를 눌러 Override 할 수 있습니다. Confidence {analysis.overallConfidence}.
      </p>

      <section>
        <h3 className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">
          10 Factors
        </h3>
        <FactorTable scores={analysis.factorScores} onSelect={(c) => setOpen(c)} />
      </section>

      {open ? (
        <div className="rounded-[var(--radius-lg)] bg-elevated p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-xs text-sage">
            Override {open} · {FACTOR_META[open].nameKo}
          </p>
          <p className="mt-1 text-xs text-muted">원래 점수는 보존됩니다. 덮어쓰지 않습니다.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[0, 2, 4, 6, 8, 10].map((n) => (
              <Button
                key={n}
                type="button"
                variant={next === n ? "primary" : "secondary"}
                size="sm"
                onClick={() => setNext(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <Textarea
            className="mt-3"
            placeholder="Override 이유"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!reason.trim()}
              onClick={() => {
                overrideFactor(analysis.id, open, next, reason.trim());
                setOpen(null);
                setReason("");
              }}
            >
              저장
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}>
              취소
            </Button>
          </div>
        </div>
      ) : null}

      <HardGatePanel gates={analysis.hardGates} />
      <RedFlagPanel flags={analysis.redFlags} />
      <TenxMathPanel analysis={analysis} />
      <ThesisCard text={analysis.oneSentenceThesis} gate={analysis.thesisGate} />

      <div className="grid gap-6 md:grid-cols-2">
        <BulletList title="Top Catalysts" items={analysis.catalysts} />
        <BulletList title="Top Risks" items={analysis.risks} />
        <BulletList title="What Must Be True" items={analysis.nextProof} />
        <BulletList title="Kill Criteria" items={analysis.killCriteria} />
        <BulletList title="Next 4 Quarterly KPIs" items={analysis.quarterlyKpis ?? []} />
      </div>

      <section>
        <h3 className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">Evidence</h3>
        <EvidenceTable items={analysis.evidences} />
      </section>

      <p className="font-mono text-[0.6875rem] text-subtle">
        {analysis.scoringVersion} · {analysis.researchProvider} ·{" "}
        <Link
          to="/company/$ticker"
          params={{ ticker: encodeURIComponent(company.ticker) }}
          className="text-sage"
        >
          기업 상세
        </Link>
      </p>
    </div>
  );
}
