import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store";
import { cleanupDemoDataFn, loadWorkspaceFn, persistWorkspaceFn } from "@/lib/persist/actions";
import { isFakeDemoCompany } from "@/lib/demo";

export function HydrateGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        await cleanupDemoDataFn();
        const db = await loadWorkspaceFn();
        if (cancelled) return;
        const cleanedLegacy = migrateLegacyLocal();
        if (db.companies.length > 0) {
          useAppStore.getState().hydrateFromDb(db);
        } else if (cleanedLegacy) {
          useAppStore.getState().hydrateFromDb(cleanedLegacy);
        }
        useAppStore.getState().purgeFakeDemo();
        useAppStore.getState().seedIdentityUniverse();
        const s = useAppStore.getState();
        await persistWorkspaceFn({
          data: {
            companies: s.companies,
            snapshots: s.snapshots,
            universes: s.universes,
            watchlist: s.watchlist,
            audit: s.audit,
            settings: s.settings,
          },
        });
        try {
          const { recoverStaleRunsFn } = await import("@/lib/persist/actions");
          await recoverStaleRunsFn();
        } catch {
          /* queue tables may be applying; do not start Full 100 */
        }
      } catch {
        useAppStore.getState().purgeFakeDemo();
        useAppStore.getState().seedIfEmpty();
      } finally {
        if (!cancelled) useAppStore.getState().setHydrated(true);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}

function migrateLegacyLocal(): {
  companies: ReturnType<typeof useAppStore.getState>["companies"];
  snapshots: ReturnType<typeof useAppStore.getState>["snapshots"];
  universes: ReturnType<typeof useAppStore.getState>["universes"];
  watchlist: string[];
  audit: ReturnType<typeof useAppStore.getState>["audit"];
  settings: ReturnType<typeof useAppStore.getState>["settings"] | null;
} | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("idt-v2");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> } & Record<string, unknown>;
    const st = (parsed.state ?? parsed) as Record<string, unknown>;
    const companies = (Array.isArray(st.companies) ? st.companies : []) as ReturnType<
      typeof useAppStore.getState
    >["companies"];
    const snapshots = (Array.isArray(st.snapshots) ? st.snapshots : []) as ReturnType<
      typeof useAppStore.getState
    >["snapshots"];
    if (!companies.length) return null;
    if (companies.every(isFakeDemoCompany)) return null;
    return {
      companies: companies.filter((c) => !isFakeDemoCompany(c)),
      snapshots,
      universes: (Array.isArray(st.universes) ? st.universes : []) as never,
      watchlist: Array.isArray(st.watchlist) ? (st.watchlist as string[]) : [],
      audit: (Array.isArray(st.audit) ? st.audit : []) as never,
      settings: (st.settings as never) ?? null,
    };
  } catch {
    return null;
  }
}
