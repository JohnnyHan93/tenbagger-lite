import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store";

export function HydrateGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    const finish = () => {
      useAppStore.getState().setHydrated(true);
      useAppStore.getState().seedIfEmpty();
    };
    const unsub = useAppStore.persist.onFinishHydration(finish);
    void useAppStore.persist.rehydrate();
    if (useAppStore.persist.hasHydrated()) finish();
    return () => {
      unsub();
    };
  }, []);

  return <>{children}</>;
}
