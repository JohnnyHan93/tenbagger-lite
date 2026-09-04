import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { exportFullBackup } from "@/lib/export";
import { LENS_VERSION } from "@/lib/engines/lenses";
import { OSM_VERSION } from "@/lib/engines/oversold";
import { MFC70_VERSION, MFC74_VERSION } from "@/lib/engines/quality";
import { XBG_VERSION } from "@/lib/engines/xbagger";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: Page });

function Page() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetSamples = useAppStore((s) => s.resetSamples);
  const purgeFakeDemo = useAppStore((s) => s.purgeFakeDemo);
  const companies = useAppStore((s) => s.companies);
  const snapshots = useAppStore((s) => s.snapshots);
  const universes = useAppStore((s) => s.universes);
  const watchlist = useAppStore((s) => s.watchlist);
  const audit = useAppStore((s) => s.audit);

  return (
    <>
      <PageTitle kicker="Model governance" title="설정" />
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[0.625rem] tracking-widest text-sage uppercase">Models</p>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            <li>X-Bagger {XBG_VERSION} · Locked</li>
            <li>Oversold {OSM_VERSION} · Locked</li>
            <li>Quality {MFC70_VERSION} · Canonical</li>
            <li>Quality {MFC74_VERSION} · Experimental (not mixed)</li>
            <li>Lenses {LENS_VERSION} · Overlay</li>
          </ul>
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
          <p className="mt-3 text-xs text-subtle">Quality model stays MFC70-v1.2. 74 is listed, not scored.</p>
        </div>
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
