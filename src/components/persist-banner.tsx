import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function PersistBanner() {
  const status = useAppStore((s) => s.persistStatus);
  const error = useAppStore((s) => s.persistError);
  const retry = useAppStore((s) => s.retryPersist);
  if (status !== "SAVE_FAILED") return null;
  return (
    <div
      role="alert"
      className="border-b border-grade-d/40 bg-grade-d/10 px-4 py-3 text-sm text-fg md:ml-56"
    >
      <p className="font-medium">저장 실패</p>
      <p className="mt-1 text-xs text-muted">분석 결과가 DB에 저장되지 않았습니다. 다시 시도하십시오.</p>
      {error ? <p className="mt-1 font-mono text-[0.65rem] text-subtle">{error}</p> : null}
      <Button variant="danger" size="sm" className="mt-2" onClick={() => retry()}>
        다시 시도
      </Button>
    </div>
  );
}
