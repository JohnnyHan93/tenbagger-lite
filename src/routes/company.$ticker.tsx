import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import {
  EngineTrio,
  FactorRows,
  SnapshotActions,
  SnapshotHeader,
  TagRow,
  TenxBlock,
} from "@/components/snapshot-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportCompanyXlsx, exportEvidenceCsv, exportHistoryCsv, exportSnapshotJson } from "@/lib/export";
import { displayTicker, ENGINE_TAB, formatOppScore, formatQualityScore, formatXScore, tickersEqual } from "@/lib/format";
import { FACTOR_ORDER } from "@/lib/scoring/config";
import { latestSnapshot, snapshotsFor, useAppStore } from "@/lib/store";
import type { FactorCode } from "@/lib/scoring/config";
import { ResearchGapsList, ResearchRequiredPanel } from "@/components/research-gaps";
import { diffSnapshots } from "@/lib/engines/diff";

export const Route = createFileRoute("/company/$ticker")({ component: CompanyPage });

function CompanyPage() {
  const { ticker } = Route.useParams();
  const decoded = decodeURIComponent(ticker);
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const watchlist = useAppStore((s) => s.watchlist);
  const toggleWatch = useAppStore((s) => s.toggleWatch);
  const overrideXFactor = useAppStore((s) => s.overrideXFactor);
  const refreshCompany = useAppStore((s) => s.refreshCompany);
  const [tab, setTab] = useState<"x" | "o" | "q" | "l" | "h" | "e" | "g">("x");
  const [busy, setBusy] = useState(false);
  const [ovCode, setOvCode] = useState<FactorCode>("F10");
  const [ovScore, setOvScore] = useState("6");
  const [ovReason, setOvReason] = useState("");

  const hydrated = useAppStore((s) => s.hydrated);
  const company =
    companies.find((c) => tickersEqual(c.ticker, decoded) && latestSnapshot(snapshots, c.id)) ??
    companies.find((c) => tickersEqual(c.ticker, decoded));
  if (!hydrated) {
    return (
      <>
        <PageTitle title="불러오는 중…" />
        <p className="text-sm text-muted">데이터베이스에서 분석 스냅샷을 복구하는 중.</p>
      </>
    );
  }
  if (!company) {
    return (
      <>
        <PageTitle title="종목을 찾을 수 없습니다" />
        <Link to="/discover" className="text-sage">
          발굴로
        </Link>
      </>
    );
  }
  const snap = latestSnapshot(snapshots, company.id);
  const hist = snapshotsFor(snapshots, company.id);
  if (!snap) {
    return (
      <>
        <PageTitle
          kicker={displayTicker(company.ticker)}
          title={company.companyName}
          action={
            <Link to="/discover">
              <Button>발굴에서 ANALYZE</Button>
            </Link>
          }
        />
        <section className="rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Identity only</p>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-subtle">Ticker</dt>
              <dd className="font-mono">{company.ticker}</dd>
            </div>
            <div>
              <dt className="text-subtle">Market</dt>
              <dd>{company.country} · {company.exchange}</dd>
            </div>
            <div>
              <dt className="text-subtle">Sector</dt>
              <dd>{company.sector}</dd>
            </div>
            <div>
              <dt className="text-subtle">Profile</dt>
              <dd>{company.testProfile ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            이 종목은 신원만 시드되어 있습니다. 가격·재무·Evidence·점수는 없습니다. Discover에서 실제 리서치를 실행하세요.
          </p>
        </section>
        <SafetyNote />
      </>
    );
  }

  return (
    <>
      <PageTitle
        kicker={displayTicker(company.ticker)}
        title={company.companyName}
        action={
          <SnapshotActions onWatch={() => toggleWatch(company.id)} watching={watchlist.includes(company.id)}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void Promise.resolve(refreshCompany(company.id)).finally(() => setBusy(false));
              }}
            >
              {busy ? "Refresh 중" : "Refresh"}
            </Button>
            <Button variant="secondary" onClick={() => exportSnapshotJson(company, snapshots)}>
              JSON
            </Button>
            <Button variant="secondary" onClick={() => exportCompanyXlsx(company, snapshots)}>
              XLSX
            </Button>
            <Button variant="ghost" onClick={() => exportEvidenceCsv(company, snapshots)}>
              Evidence CSV
            </Button>
            <Button variant="ghost" onClick={() => exportHistoryCsv(company, snapshots)}>
              History CSV
            </Button>
          </SnapshotActions>
        }
      />
      <SnapshotHeader company={company} snapshot={snap} />
      <div className="mt-4">
        <TagRow tags={snap.tags} />
        {snap.researchPriority != null ? (
          <p className="mt-2 font-mono text-xs text-muted">Research Priority {snap.researchPriority} (조사 순서)</p>
        ) : null}
      </div>
      <EngineTrio snapshot={snap} ticker={company.ticker} onPick={(id) => setTab(id)} />
      <ResearchRequiredPanel snapshot={snap} company={company} />
      <p className="mt-6 text-sm text-fg">{snap.oneSentenceThesis}</p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {(
          [
            ["x", ENGINE_TAB.xbagger.name, formatXScore(snap.xbagger.adjustedScore)],
            ["o", ENGINE_TAB.oversold.name, formatOppScore(snap.oversold.opportunity)],
            ["q", ENGINE_TAB.quality.name, formatQualityScore(snap.quality.score)],
          ] as const
        ).map(([id, label, score]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "min-h-11 rounded-[var(--radius-md)] bg-accent px-2 py-2 font-mono text-accent-fg"
                : "min-h-11 rounded-[var(--radius-md)] bg-elevated px-2 py-2 font-mono text-muted"
            }
          >
            <span className="block text-[0.625rem] tracking-wide">{label}</span>
            <span className="mt-0.5 block text-xs tabular-nums">{score}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("l")}
          className={
            tab === "l"
              ? "h-9 rounded-[var(--radius-md)] bg-accent px-3 font-mono text-xs text-accent-fg"
              : "h-9 rounded-[var(--radius-md)] bg-elevated px-3 font-mono text-xs text-muted"
          }
        >
          Lenses
        </button>
        <button
          type="button"
          onClick={() => setTab("g")}
          className={
            tab === "g"
              ? "h-9 rounded-[var(--radius-md)] bg-accent px-3 font-mono text-xs text-accent-fg"
              : "h-9 rounded-[var(--radius-md)] bg-elevated px-3 font-mono text-xs text-muted"
          }
        >
          Gaps
        </button>
        <button
          type="button"
          onClick={() => setTab("e")}
          className={
            tab === "e"
              ? "h-9 rounded-[var(--radius-md)] bg-accent px-3 font-mono text-xs text-accent-fg"
              : "h-9 rounded-[var(--radius-md)] bg-elevated px-3 font-mono text-xs text-muted"
          }
        >
          Evidence
        </button>
        <button
          type="button"
          onClick={() => setTab("h")}
          className={
            tab === "h"
              ? "h-9 rounded-[var(--radius-md)] bg-accent px-3 font-mono text-xs text-accent-fg"
              : "h-9 rounded-[var(--radius-md)] bg-elevated px-3 font-mono text-xs text-muted"
          }
        >
          History
        </button>
      </div>
      <div className="mt-4">
        {tab === "x" ? (
          <>
            <p className="mb-3 font-mono text-xs text-muted">
              {ENGINE_TAB.xbagger.name} {ENGINE_TAB.xbagger.version} · 총점 {formatXScore(snap.xbagger.adjustedScore)} ·
              Grade {snap.xbagger.grade}
            </p>
            <TenxBlock snapshot={snap} />
            <div className="mt-4">
              <FactorRows
                rows={snap.xbagger.factors.map((f) => ({
                  id: f.id,
                  name: f.name,
                  score: f.score,
                  weight: f.weight,
                  reason: f.reason,
                  status: f.status,
                }))}
              />
            </div>
            <div className="mt-4 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
              <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Manual override</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={ovCode}
                  onChange={(e) => setOvCode(e.target.value as FactorCode)}
                  className="h-11 rounded-[var(--radius-md)] bg-inset px-3 font-mono text-sm"
                >
                  {FACTOR_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Input value={ovScore} onChange={(e) => setOvScore(e.target.value)} className="w-20" />
                <Input value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="reason" />
                <Button
                  onClick={() => {
                    const n = Number(ovScore);
                    if (!ovReason || !Number.isFinite(n)) return;
                    overrideXFactor(snap.id, ovCode, n, ovReason);
                  }}
                >
                  Override
                </Button>
              </div>
              <p className="mt-2 text-xs text-subtle">원본은 유지되고 새 스냅샷이 생깁니다.</p>
            </div>
          </>
        ) : null}
        {tab === "o" ? (
          <>
            <p className="mb-3 text-sm text-muted">
              {ENGINE_TAB.oversold.name} {ENGINE_TAB.oversold.version} · Opp {formatOppScore(snap.oversold.opportunity)}{" "}
              · Case {snap.oversold.case}
            </p>
            <p className="mb-3 font-mono text-xs text-subtle">
              Opp = 0.40×Fundamental + 0.25×Valuation + 0.10×Oversold + 0.25×Risk Inverse. Value Trap은 별도 1–10.
            </p>
            <FactorRows
              rows={[
                { id: "FUND", name: "Fundamental 40%", score: snap.oversold.fundamental, reason: snap.oversold.reasons.fundamental },
                { id: "VAL", name: "Valuation 25%", score: snap.oversold.valuation, reason: snap.oversold.reasons.valuation },
                { id: "OS", name: "Oversold 10%", score: snap.oversold.oversold, reason: snap.oversold.reasons.oversold },
                { id: "RISK", name: "Risk Inverse 25%", score: snap.oversold.riskInverse, reason: snap.oversold.reasons.risk },
                { id: "VT", name: "Value Trap (not in Opp)", score: snap.oversold.valueTrap, reason: snap.oversold.reasons.trap },
              ]}
            />
          </>
        ) : null}
        {tab === "q" ? (
          <>
            <p className="mb-3 text-sm text-muted">
              {ENGINE_TAB.quality.name} {ENGINE_TAB.quality.version} · {formatQualityScore(snap.quality.score)} · Grade{" "}
              {snap.quality.grade}
            </p>
            <div className="mb-4 grid gap-2 md:grid-cols-3">
              {snap.quality.pillars.map((p) => (
                <div key={p.pillar} className="rounded-[var(--radius-md)] bg-surface p-3 shadow-[var(--shadow-border)]">
                  <p className="font-mono text-xs text-sage">{p.pillar}</p>
                  <p className="font-mono text-lg tabular-nums">{p.score == null ? "N/A" : `${p.score.toFixed(1)} / 10`}</p>
                  <p className="text-xs text-subtle">{Math.round(p.coverage * 100)}%</p>
                </div>
              ))}
            </div>
            <FactorRows
              rows={snap.quality.factors.map((f) => ({
                id: f.id,
                name: `${f.name} [${f.kind}]`,
                score: f.score,
                reason: f.reason,
                status: f.status,
              }))}
            />
          </>
        ) : null}
        {tab === "l" ? (
          <div className="grid gap-3 md:grid-cols-2">
            {snap.lenses.map((l) => (
              <div key={l.id} className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
                <p className="font-mono text-xs text-sage">{l.name}</p>
                <p className="masthead text-2xl">{l.verdict}</p>
                <p className="text-xs text-muted">Coverage {Math.round(l.coverage * 100)}%</p>
                <p className="mt-2 text-sm">{l.strengths.join(" · ") || "—"}</p>
                <p className="mt-1 text-sm text-grade-d">{l.concerns.join(" · ")}</p>
                <p className="mt-2 text-xs text-subtle">{l.questions[0]}</p>
              </div>
            ))}
            <p className="text-xs text-subtle md:col-span-2">
              10대 렌즈는 공개된 투자철학의 운영용 재구성입니다. 실제 인물을 사칭하지 않습니다. Quality 점수에
              합산되지 않습니다.
            </p>
          </div>
        ) : null}
        {tab === "g" ? <ResearchGapsList snapshot={snap} company={company} /> : null}
        {tab === "e" ? (
          <div className="space-y-2">
            {snap.evidence.length === 0 ? <p className="text-sm text-muted">증거가 없습니다.</p> : null}
            {snap.evidence.map((e) => (
              <div key={e.id} className="rounded-[var(--radius-md)] bg-surface p-3 shadow-[var(--shadow-border)]">
                <p className="font-mono text-xs text-sage">
                  {e.id} · {e.factorCode} · {e.evidenceType} · {e.sourceTier ?? "TIER_3"} · {e.status ?? "ACTIVE"}
                </p>
                <p className="mt-1 text-sm">{e.statement ?? e.evidence}</p>
                <p className="mt-1 text-xs text-subtle">
                  {e.sourceName}
                  {e.sourceUrl ? ` · ${e.sourceUrl}` : ""} · {e.publishedAt ?? e.sourceDate} · conf{" "}
                  {typeof e.confidence === "number" ? e.confidence.toFixed(2) : e.confidence}
                </p>
                {e.factorTargets?.length ? (
                  <p className="mt-1 font-mono text-[0.625rem] text-muted">
                    factors {e.factorTargets.join(", ")}
                    {e.engineTargets?.length ? ` · engines ${e.engineTargets.join(", ")}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {tab === "h" ? (
          <ul className="space-y-2">
            {hist.map((s, i) => {
              const prev = i > 0 ? hist[i - 1] : null;
              const d = prev ? diffSnapshots(prev, s) : null;
              return (
                <li
                  key={s.id}
                  className="rounded-[var(--radius-md)] bg-surface px-3 py-2 font-mono text-sm shadow-[var(--shadow-border)]"
                >
                  <p>
                    {s.createdAt.slice(0, 16)} · X {formatXScore(s.xbagger.adjustedScore)}
                    {d?.scoreDelta.xbagger != null
                      ? ` (${d.scoreDelta.xbagger >= 0 ? "+" : ""}${d.scoreDelta.xbagger.toFixed(0)})`
                      : ""}{" "}
                    · Oversold {formatOppScore(s.oversold.opportunity)}
                    {d?.scoreDelta.oversold != null
                      ? ` (${d.scoreDelta.oversold >= 0 ? "+" : ""}${d.scoreDelta.oversold.toFixed(1)})`
                      : ""}{" "}
                    · Quality {formatQualityScore(s.quality.score)}
                    {d?.scoreDelta.quality != null
                      ? ` (${d.scoreDelta.quality >= 0 ? "+" : ""}${d.scoreDelta.quality.toFixed(0)})`
                      : ""}{" "}
                    · cov {Math.round(s.overallCoverage * 100)}% · {s.overallConfidence} · {s.researchProvider}
                    {s.industryAdapter ? ` · ${s.industryAdapter}` : ""}
                  </p>
                  {d ? (
                    <p className="mt-1 text-[0.625rem] text-subtle">
                      Δcov {d.coverageDelta.overall >= 0 ? "+" : ""}
                      {(d.coverageDelta.overall * 100).toFixed(0)}pp · factor {d.factorChanges.length} · evidence +
                      {d.evidenceAdded.length} / invalidated {d.evidenceInvalidated.length}
                    </p>
                  ) : (
                    <p className="mt-1 text-[0.625rem] text-subtle">최초 스냅샷</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <SafetyNote />
    </>
  );
}
