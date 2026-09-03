import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, SafetyNote } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportUniverseJson } from "@/lib/export";
import { useAppStore } from "@/lib/store";
import { previewImport } from "@/lib/universe/parse";

export const Route = createFileRoute("/universe")({ component: Page });

function Page() {
  const universes = useAppStore((s) => s.universes);
  const importUniverseText = useAppStore((s) => s.importUniverseText);
  const lockUniverse = useAppStore((s) => s.lockUniverse);
  const unlockUniverse = useAppStore((s) => s.unlockUniverse);
  const archiveUniverse = useAppStore((s) => s.archiveUniverse);
  const [name, setName] = useState("My Universe");
  const [text, setText] = useState("");
  const preview = text.trim() ? previewImport(text) : null;

  return (
    <>
      <PageTitle kicker="Universe Manager" title="유니버스" />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Locked 59는 이번 빌드에 넣지 않습니다. CSV / JSON / MD 테이블을 가져오면 잠금·버전 관리가 됩니다.
      </p>
      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-3 h-32 w-full rounded-[var(--radius-md)] bg-inset p-3 font-mono text-xs shadow-[var(--shadow-border)]"
          placeholder="ticker list"
        />
        {preview ? (
          <p className="mt-2 text-xs text-muted">
            Dry-run {preview.count} · {preview.sample.join(", ")} {preview.errors[0] ?? ""}
          </p>
        ) : null}
        <Button className="mt-3" onClick={() => importUniverseText(name || "Imported", "GLOBAL", text)}>
          Import & version
        </Button>
      </section>
      <div className="mt-6 grid gap-3">
        {universes.map((u) => (
          <div key={u.id} className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="masthead text-xl">{u.name}</p>
                <p className="font-mono text-xs text-muted">
                  v{u.version} · {u.status} · {u.tickers.length} names · {u.market}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {u.status === "open" ? (
                  <Button size="sm" variant="secondary" onClick={() => lockUniverse(u.id)}>
                    Lock
                  </Button>
                ) : u.status === "locked" ? (
                  <Button size="sm" variant="secondary" onClick={() => unlockUniverse(u.id)}>
                    Unlock
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => archiveUniverse(u.id)}>
                  Archive
                </Button>
                <Button size="sm" variant="ghost" onClick={() => exportUniverseJson(u)}>
                  JSON
                </Button>
              </div>
            </div>
            <p className="mt-3 font-mono text-xs text-subtle">
              {u.tickers
                .slice(0, 12)
                .map((t) => t.ticker)
                .join("  ")}
              {u.tickers.length > 12 ? " …" : ""}
            </p>
          </div>
        ))}
      </div>
      <SafetyNote />
    </>
  );
}
