import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { exportCriteriaPack, exportFullBackup } from "@/lib/export";
import { LENS_VERSION } from "@/lib/engines/lenses";
import { MFC74_VERSION } from "@/lib/engines/quality";
import { CRITERIA_RUNTIME, cloneDefaultCriteria, hashCriteria, parseCriteriaPack } from "@/lib/engines/criteria/index";
import { getCriteria, isBuiltinCriteria } from "@/lib/engines/criteria/active";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSamples = useAppStore((s) => s.resetSamples);
  const purgeFakeDemo = useAppStore((s) => s.purgeFakeDemo);
  const applyCriteriaPack = useAppStore((s) => s.applyCriteriaPack);
  const resetCriteriaPack = useAppStore((s) => s.resetCriteriaPack);
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const universes = useAppStore((s) => s.universes);
  const watchlist = useAppStore((s) => s.watchlist);
  const audit = useAppStore((s) => s.audit);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileMode, setFileMode] = useState<"apply" | "validate">("apply");
  const [criteriaMsg, setCriteriaMsg] = useState<string | null>(null);
  const active = settings.criteriaPack ?? getCriteria();
  const builtin = !settings.criteriaPack && isBuiltinCriteria();
  const hash = hashCriteria(active);

  return (
    <>
      <PageTitle kicker="Model governance" title="설정" />
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Models</p>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            <li>Criteria {CRITERIA_RUNTIME}</li>
            <li>X-Bagger {active.engines.xbagger.version}{builtin ? " · Locked" : " · Overlay"}</li>
            <li>Oversold {active.engines.oversold.version}{builtin ? " · Locked" : " · Overlay"}</li>
            <li>Quality {active.engines.quality70.version} · Canonical</li>
            <li>Quality {MFC74_VERSION} · Experimental (not mixed)</li>
            <li>Lenses {LENS_VERSION} · Overlay</li>
          </ul>
          <p className="mt-3 font-mono text-[0.625rem] text-muted">hash {hash}</p>
          <p className="mt-3 text-xs text-subtle">
            세 엔진 점수는 합치지 않습니다. 기준 변경은 다음 분석부터 적용되고, 과거 스냅샷은 그대로입니다.
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Toggles</p>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm">
            Research Priority
            <input
              type="checkbox"
              checked={settings.researchPriorityOn}
              onChange={(e) => updateSettings({ researchPriorityOn: e.target.checked })}
            />
          </label>
          <label className="mt-2 flex items-center justify-between gap-3 text-sm">
            Use Grok overlay
            <input
              type="checkbox"
              checked={settings.useAi}
              onChange={(e) => updateSettings({ useAi: e.target.checked })}
            />
          </label>
          <p className="mt-3 text-xs text-subtle">Quality model stays MFC70-v1.3. 74 is listed, not scored.</p>
        </div>
      </section>

      <section className="mt-6 rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">분석 기준 JSON</p>
        <p className="mt-2 text-sm text-fg">{active.title}</p>
        <p className="mt-1 text-xs text-muted">
          overlay {active.overlayId}
          {active.appliedAt ? ` · 적용 ${active.appliedAt}` : " · 내장"}
          {` · ${hash}`}
        </p>
        <p className="mt-2 text-xs text-subtle">
          내보내고 숫자만 고친 뒤 다시 넣으면 됩니다. 공식을 바꾸는 일(새 팩터, 합산 점수)은 여기가 아니라 코드입니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => exportCriteriaPack(settings.criteriaPack ?? cloneDefaultCriteria())}
          >
            기준 내보내기
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setFileMode("apply");
              fileRef.current?.click();
            }}
          >
            기준 가져와서 적용
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setFileMode("validate");
              fileRef.current?.click();
            }}
          >
            검증만
          </Button>
          {!builtin ? (
            <Button
              variant="ghost"
              onClick={() => {
                resetCriteriaPack();
                setCriteriaMsg("내장 기준으로 되돌렸습니다. 다음 분석부터 적용됩니다.");
              }}
            >
              내장 기준으로
            </Button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const mode = fileMode;
            e.target.value = "";
            if (!file) return;
            void file.text().then((text) => {
              try {
                const parsed = parseCriteriaPack(JSON.parse(text));
                if (!parsed.ok) {
                  setCriteriaMsg(`검증 실패: ${parsed.error}. 기존 기준을 유지합니다.`);
                  return;
                }
                if (mode === "validate") {
                  setCriteriaMsg(`검증 통과: ${parsed.pack.title} · hash ${hashCriteria(parsed.pack)}. 아직 적용하지 않았습니다.`);
                  return;
                }
                applyCriteriaPack(parsed.pack);
                setCriteriaMsg(`적용됨: ${parsed.pack.title} · hash ${hashCriteria(parsed.pack)}. 이미 저장된 분석은 그대로이고, 다음 분석부터 새 기준입니다.`);
              } catch {
                setCriteriaMsg("JSON을 읽지 못했습니다. 기존 기준을 유지합니다.");
              }
            });
          }}
        />
        {criteriaMsg ? <p className="mt-3 text-xs text-muted">{criteriaMsg}</p> : null}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => exportFullBackup({ companies, snapshots, universes, watchlist, settings, audit })}
        >
          Backup JSON
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            purgeFakeDemo();
            void import("@/lib/persist/actions").then(({ cleanupDemoDataFn }) => cleanupDemoDataFn());
          }}
        >
          가짜 데모 삭제
        </Button>
        <Button variant="ghost" onClick={() => resetSamples()}>
          100 종목 신원 유니버스
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted">
        Audit log {audit.length} entries. 시드는 ticker / 회사명 / 시장만 넣습니다. 점수·재무·Evidence는 넣지 않습니다.
        현재 {companies.length} 종목 · 분석 {snapshots.length}건.
      </p>
      <SafetyNote />
    </>
  );
}
