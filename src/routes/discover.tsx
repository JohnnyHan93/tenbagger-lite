import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { EngineTrio, SnapshotHeader } from "@/components/snapshot-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { researchTicker } from "@/lib/research/ticker";
import { latestSnapshot, useAppStore } from "@/lib/store";
import type { Company } from "@/lib/types";
import { uid } from "@/lib/utils";
import { previewImport } from "@/lib/universe/parse";

export const Route = createFileRoute("/discover")({ component: DiscoverPage });

function DiscoverPage() {
  const navigate = useNavigate();
  const upsertCompany = useAppStore((s) => s.upsertCompany);
  const saveFromDraft = useAppStore((s) => s.saveFromDraft);
  const useAi = useAppStore((s) => s.settings.useAi);
  const importUniverseText = useAppStore((s) => s.importUniverseText);
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: string[]; errors: string[] } | null>(null);
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const [lastId, setLastId] = useState<string | null>(null);

  async function run() {
    setError("");
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
        return;
      }
      const q = res.draft.quote;
      const existing = companies.find((c) => c.ticker.toUpperCase() === q.ticker.toUpperCase());
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
      const saved = upsertCompany(company);
      const snap = saveFromDraft(saved, res.draft);
      setLastId(saved.id);
      void snap;
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setBusy(false);
    }
  }

  const company = companies.find((c) => c.id === lastId);
  const snap = company ? latestSnapshot(snapshots, company.id) : undefined;

  return (
    <>
      <PageTitle kicker="Discover" title="종목 발굴" />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Single ticker</p>
          <div className="mt-3 flex gap-2">
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="IONQ / 005930"
              onKeyDown={(e) => e.key === "Enter" && void run()}
            />
            <Button disabled={busy} onClick={() => void run()}>
              {busy ? "분석 중" : "ANALYZE"}
            </Button>
          </div>
          {error ? <p className="mt-2 text-sm text-grade-d">{error}</p> : null}
          <p className="mt-3 text-xs text-subtle">공시·시세 팩을 모은 뒤 세 엔진이 독립 채점합니다. AI는 선택.</p>
        </section>
        <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Universe paste</p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            className="mt-3 h-28 w-full rounded-[var(--radius-md)] bg-inset p-3 font-mono text-xs text-fg shadow-[var(--shadow-border)]"
            placeholder={"INOD\nDSP\nMNTN 또는 CSV / JSON / MD 테이블"}
          />
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" onClick={() => setPreview(previewImport(paste))}>
              Dry-run
            </Button>
            <Button
              onClick={() => {
                const u = importUniverseText("Imported", "GLOBAL", paste);
                void navigate({ to: "/universe" });
                void u;
              }}
            >
              Import
            </Button>
          </div>
          {preview ? (
            <p className="mt-2 text-xs text-muted">
              {preview.count} tickers · {preview.sample.join(", ")}
              {preview.errors.length ? ` · ${preview.errors[0]}` : ""}
            </p>
          ) : null}
        </section>
      </div>
      {company && snap ? (
        <div className="mt-8">
          <SnapshotHeader company={company} snapshot={snap} />
          <EngineTrio snapshot={snap} ticker={company.ticker} />
        </div>
      ) : null}
      <SafetyNote />
    </>
  );
}
