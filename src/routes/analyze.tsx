import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnalysisView } from "@/components/analysis-view";
import { ManualForm } from "@/components/manual-form";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { researchTicker } from "@/lib/research/ticker";
import { latestAnalysis, useAppStore } from "@/lib/store";
import type { Analysis, Company, ResearchDraft } from "@/lib/types";
import { uid } from "@/lib/utils";

export const Route = createFileRoute("/analyze")({ component: AnalyzePage });

const HINTS = ["277810", "ALAB", "005930", "RKLB", "ASTS", "CRDO", "IONQ"];

function AnalyzePage() {
  const navigate = useNavigate();
  const saveAnalysis = useAppStore((s) => s.saveAnalysis);
  const useAi = useAppStore((s) => s.settings.useAi);
  const companies = useAppStore((s) => s.companies);
  const analyses = useAppStore((s) => s.analyses);
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const [result, setResult] = useState<{ company: Company; analysis: Analysis } | null>(null);
  const [prevScore, setPrevScore] = useState<number | null>(null);

  function persistDraft(draft: ResearchDraft) {
    const q = draft.quote;
    const existing = companies.find(
      (c) => c.ticker.toUpperCase() === q.ticker.toUpperCase(),
    );
    const prev = existing ? latestAnalysis(analyses, existing.id) : undefined;
    setPrevScore(prev ? prev.adjustedScore : null);
    const company: Company = {
      id: existing?.id ?? uid("c"),
      ticker: q.ticker,
      exchange: q.exchange,
      companyName: q.companyName,
      country: q.country,
      sector: q.sector,
      industry: q.industry,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const analysis = saveAnalysis(company, draft);
    setResult({ company, analysis });
  }

  async function runAuto() {
    setError("");
    setResult(null);
    const t = ticker.trim();
    if (!t) {
      setError("티커를 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await researchTicker({ data: { ticker: t, useAi } });
      if (!res.ok) {
        setError(res.error);
        setManual(true);
        return;
      }
      persistDraft(res.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
      setManual(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle kicker="Analyze" title="티커 분석" />

      <form
        className="flex flex-col gap-3 md:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void runAuto();
        }}
      >
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="RKLB  /  ALAB  /  005930"
          className="h-12 font-mono text-lg tracking-wide md:flex-1"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "분석 중…" : "ANALYZE"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          onClick={() => setManual((v) => !v)}
        >
          Manual
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {HINTS.map((h) => (
          <button
            key={h}
            type="button"
            className="h-8 rounded-full bg-elevated px-3 font-mono text-xs text-muted hover:text-fg"
            onClick={() => setTicker(h)}
          >
            {h}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-subtle">
        {useAi
          ? "자동 모드: 시세 수집 후 Grok 리서치를 시도합니다. 실패하면 휴리스틱 + Manual로 이어집니다."
          : "시세만 수집합니다. 팩터 2점은 증거가 있을 때만 부여됩니다."}
      </p>

      {error ? (
        <p className="mt-4 rounded-[var(--radius-md)] bg-grade-d/10 px-3 py-2 text-sm text-grade-d">
          {error}
        </p>
      ) : null}

      {manual ? (
        <div className="mt-8">
          <h2 className="masthead mb-4 text-2xl">Manual Mode</h2>
          <ManualForm
            initialTicker={ticker}
            busy={busy}
            onSubmit={(draft) => {
              persistDraft(draft);
              setManual(false);
            }}
          />
        </div>
      ) : null}

      {result ? (
        <div className="mt-8 space-y-4">
          {prevScore != null ? (
            <p className="font-mono text-sm text-muted">
              Refresh · 이전 {Math.round(prevScore)} → 이번{" "}
              {Math.round(result.analysis.adjustedScore)} (
              {result.analysis.adjustedScore - prevScore >= 0 ? "+" : ""}
              {Math.round(result.analysis.adjustedScore - prevScore)})
            </p>
          ) : (
            <p className="font-mono text-sm text-muted">신규 분석이 저장되었습니다.</p>
          )}
          <AnalysisView company={result.company} analysis={result.analysis} />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void navigate({
                to: "/company/$ticker",
                params: { ticker: encodeURIComponent(result.company.ticker) },
              })
            }
          >
            기업 페이지로
          </Button>
        </div>
      ) : null}

      <SafetyNote />
    </>
  );
}
