import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { persistHealthFn } from "@/lib/persist/actions";

type Health = {
  backend: "neon" | "pglite";
  durable: boolean;
  companies: number;
  analyses: number;
};

export function PersistBanner() {
  const status = useAppStore((s) => s.persistStatus);
  const error = useAppStore((s) => s.persistError);
  const retry = useAppStore((s) => s.retryPersist);
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

  const ephemeral = health && !health.durable;
  const failed = status === "SAVE_FAILED";
  if (!failed && !ephemeral) return null;

  return (
    <div
      role="alert"
      className="border-b border-grade-d/40 bg-grade-d/10 px-4 py-3 text-sm text-fg md:ml-56"
    >
      {failed ? (
        <>
          <p className="font-medium">저장 실패</p>
          <p className="mt-1 text-xs text-muted">분석 결과가 DB에 저장되지 않았습니다. 다시 시도하십시오.</p>
          {error ? <p className="mt-1 font-mono text-[0.65rem] text-subtle">{error}</p> : null}
          <Button variant="danger" size="sm" className="mt-2" onClick={() => retry()}>
            다시 시도
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium">서버 DB가 휘발성입니다</p>
          <p className="mt-1 text-xs text-muted">
            현재 백엔드 {health?.backend}. Production에는 Neon `DATABASE_URL`이 있어야 분석이 남습니다. 호스팅 Vercel 프로젝트 환경변수를 확인하십시오.
          </p>
          <p className="mt-1 font-mono text-[0.65rem] text-subtle">
            companies {health?.companies ?? 0} · analyses {health?.analyses ?? 0}
          </p>
        </>
      )}
    </div>
  );
}
