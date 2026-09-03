import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { backupJson } from "@/lib/export";
import { SCORING_VERSION } from "@/lib/scoring/config";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSamples = useAppStore((s) => s.resetSamples);
  const clearAll = useAppStore((s) => s.clearAll);
  const importState = useAppStore((s) => s.importState);
  const snapshot = useAppStore((s) => ({
    companies: s.companies,
    analyses: s.analyses,
    handoffs: s.handoffs,
    watchlist: s.watchlist,
    settings: s.settings,
  }));

  function onRestore(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as typeof snapshot;
        if (!Array.isArray(data.companies) || !Array.isArray(data.analyses)) {
          throw new Error("invalid");
        }
        importState(data);
      } catch {
        alert("백업 파일을 읽을 수 없습니다.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <PageTitle kicker="Settings" title="설정" />

      <section className="space-y-4 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">Research</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Grok 자동 리서치</span>
          <input
            type="checkbox"
            className="size-5 accent-sage"
            checked={settings.useAi}
            onChange={(e) => updateSettings({ useAi: e.target.checked })}
          />
        </label>
        <p className="text-xs text-subtle">
          꺼두면 시세만 가져오고 팩터는 휴리스틱/수동입니다. 리서치가 실패해도 앱은 동작합니다.
        </p>
      </section>

      <section className="mt-4 space-y-3 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">Data</h2>
        <p className="text-sm text-muted">
          데이터는 이 기기에 저장됩니다. 과거 분석은 덮어쓰지 않습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => backupJson(snapshot)}>
            Backup
          </Button>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-[var(--radius-md)] bg-elevated px-4 text-sm font-medium">
            Restore
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onRestore(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button variant="secondary" onClick={() => resetSamples()}>
            샘플 3종목 복원
          </Button>
          <Button variant="danger" onClick={() => {
            if (confirm("모든 분석을 삭제할까요?")) clearAll();
          }}>
            전체 삭제
          </Button>
        </div>
      </section>

      <section className="mt-4 space-y-2 rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">Scoring</h2>
        <p className="font-mono text-sm">{SCORING_VERSION}</p>
        <p className="text-sm text-muted">
          85+ A DEEP DIVE NOW · 70–84 B WATCH · 55–69 C WAIT FOR PROOF · 0–54 D PASS
        </p>
        <p className="text-sm text-muted">
          Survival RED / 10x RED = Hard Stop (점수와 무관하게 D / PASS)
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to="/analyze" className="text-sage">
            분석
          </Link>
          <Link to="/handoff" className="text-sage">
            Master Handoff
          </Link>
          <Link to="/history" className="text-sage">
            이력
          </Link>
        </div>
      </section>

      <SafetyNote />
    </>
  );
}
