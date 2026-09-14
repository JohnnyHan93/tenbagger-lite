import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { persistHealthFn } from "@/lib/persist/actions";

type Health = {
  backend: "neon" | "pglite";
  durable: boolean;
  companies: number;
  analyses: number;
  production?: boolean;
};

export function PersistBanner() {
  const status = useAppStore((s) => s.persistStatus);
  const error = useAppStore((s) => s.persistError);
  const retry = useAppStore((s) => s.retryPersist);
  const localCompanies = useAppStore((s) => s.companies.length);
  const localAnalyses = useAppStore((s) => s.snapshots.length);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    void persistHealthFn()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const ephemeral = Boolean(health?.production && !health.durable);
  const failed = status === "SAVE_FAILED";
  if (!failed && !ephemeral) return null;

  return (
    <div
      role="alert"
      className="border-b border-grade-d/40 bg-grade-d/10 px-4 py-3 text-sm text-fg md:ml-56"
    >
      {failed ? (
        <>
          <p className="font-medium">서버 저장 실패</p>
          <p className="mt-1 text-xs text-muted">
            이 화면의 숫자는 이 기기에만 있습니다. 서버에는 아직 안 남았습니다.
          </p>
          {error ? <p className="mt-1 font-mono text-[0.65rem] text-subtle">{error}</p> : null}
          <Button variant="danger" size="sm" className="mt-2" onClick={() => retry()}>
            서버에 다시 저장
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium">이 화면은 이 기기 저장입니다</p>
          <p className="mt-1 text-xs text-muted">
            유니버스 {localCompanies} · 분석 {localAnalyses}은 폰/브라우저에 있습니다. 서버 DB는
            비어 있습니다 (companies {health?.companies ?? 0} · analyses {health?.analyses ?? 0}).
            앱을 지우거나 다른 기기에서는 보이지 않습니다.
          </p>
        </>
      )}
    </div>
  );
}
