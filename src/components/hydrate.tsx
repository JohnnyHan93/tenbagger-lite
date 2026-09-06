import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store";
import { cleanupDemoDataFn, loadWorkspaceFn, persistWorkspaceFn } from "@/lib/persist/actions";
import { isFakeDemoCompany } from "@/lib/demo";
import { mergeWorkspaces } from "@/lib/bootstrap";

function waitForLocalCache(): Promise<void> {
  const api = useAppStore.persist;
  if (api.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const unsub = api.onFinishHydration(done);
    if (api.hasHydrated()) {
      unsub();
      done();
      return;
    }
    setTimeout(() => {
      unsub();
      done();
    }, 1500);
  });
}

export function HydrateGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      await waitForLocalCache();
      if (cancelled) return;
      try {
        await cleanupDemoDataFn();
        const db = await loadWorkspaceFn();
        if (cancelled) return;
        const local = {
          companies: useAppStore.getState().companies,
          snapshots: useAppStore.getState().snapshots,
          universes: useAppStore.getState().universes,
          watchlist: useAppStore.getState().watchlist,
          audit: useAppStore.getState().audit,
          settings: useAppStore.getState().settings,
        };
        const legacy = migrateLegacyLocal();
        const fromBrowser = local.companies.length > 0 || local.snapshots.length > 0 ? local : legacy;
        const merged = mergeWorkspaces(fromBrowser ?? emptySlice(local.settings), db);
        if (merged.companies.length > 0 || merged.snapshots.length > 0) {
          useAppStore.getState().hydrateFromDb(merged);
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
        const s = useAppStore.getState();
        s.purgeFakeDemo();
        if (s.companies.length === 0) s.seedIfEmpty();
        else s.seedIdentityUniverse();
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

function emptySlice(settings: ReturnType<typeof useAppStore.getState>["settings"]) {
  return {
    companies: [] as ReturnType<typeof useAppStore.getState>["companies"],
    snapshots: [] as ReturnType<typeof useAppStore.getState>["snapshots"],
    universes: [] as ReturnType<typeof useAppStore.getState>["universes"],
    watchlist: [] as string[],
    audit: [] as ReturnType<typeof useAppStore.getState>["audit"],
    settings,
  };
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
