import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { EMPTY_SETTINGS, emptyWorkspace, identityUniverseWorkspace, mergeIdentityUniverse, stripDemoFromWorkspace } from "./bootstrap.ts";
import { runSnapshot, runSnapshotFromDraft, snapshotToDraft } from "./engines/run.ts";
import { parseTickerList, type UniverseTicker } from "./universe/parse.ts";
import { uid } from "./utils.ts";
import type { AppSettings, AuditLog, Snapshot, Universe } from "./domain/snapshot.ts";
import type { Company, ResearchDraft, ResearchQuote } from "./types.ts";
import type { ResearchPack } from "./research/pack.ts";
import type { FactorCode } from "./scoring/config.ts";
import { emptyPack } from "./research/pack.ts";
import { scoreXBagger } from "./engines/xbagger.ts";
import { strategyTags, researchPriority } from "./engines/matrix.ts";
import { scoreLenses } from "./engines/lenses.ts";

export type PersistStatus = "IDLE" | "SAVING" | "SAVED" | "SAVE_FAILED";

export interface AppState {
  hydrated: boolean;
  persistStatus: PersistStatus;
  persistError: string | null;
  companies: Company[];
  snapshots: Snapshot[];
  universes: Universe[];
  watchlist: string[];
  audit: AuditLog[];
  settings: AppSettings;
  setHydrated: (v: boolean) => void;
  seedIfEmpty: () => void;
  seedIdentityUniverse: () => void;
  purgeFakeDemo: () => void;
  resetSamples: () => void;
  clearAll: () => void;
  upsertCompany: (c: Company) => Company;
  saveFromQuote: (company: Company, quote: ResearchQuote, pack?: ResearchPack) => Snapshot;
  saveFromDraft: (company: Company, draft: ResearchDraft, pack?: ResearchPack) => Snapshot;
  refreshCompany: (companyId: string) => Snapshot | null | Promise<Snapshot | null>;
  hydrateFromDb: (data: {
    companies: Company[];
    snapshots: Snapshot[];
    universes: Universe[];
    watchlist: string[];
    audit: AuditLog[];
    settings?: AppSettings | null;
  }) => void;
  overrideXFactor: (snapshotId: string, code: FactorCode, score: number, reason: string) => void;
  toggleWatch: (companyId: string) => void;
  importJson: (data: Partial<Pick<AppState, "companies" | "snapshots" | "universes" | "watchlist" | "settings">>) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  createUniverse: (name: string, market: Universe["market"], tickers: UniverseTicker[]) => Universe;
  importUniverseText: (name: string, market: Universe["market"], text: string) => Universe;
  lockUniverse: (id: string) => void;
  unlockUniverse: (id: string) => void;
  archiveUniverse: (id: string) => void;
  retryPersist: () => void;
}

const emptySettings = EMPTY_SETTINGS;

function identityState() {
  const world = identityUniverseWorkspace(emptySettings);
  return {
    companies: world.companies,
    snapshots: world.snapshots,
    universes: world.universes,
    watchlist: world.watchlist,
    audit: world.audit,
    settings: world.settings ?? emptySettings,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      persistStatus: "IDLE",
      persistError: null,
      ...emptyWorkspace(emptySettings),
      settings: emptySettings,
      setHydrated: (v) => set({ hydrated: v }),
      seedIfEmpty: () => {
        if (get().companies.length === 0) set(identityState());
        else get().seedIdentityUniverse();
      },
      seedIdentityUniverse: () => {
        const stripped = stripDemoFromWorkspace({
          companies: get().companies,
          snapshots: get().snapshots,
          universes: get().universes,
          watchlist: get().watchlist,
          audit: get().audit,
          settings: get().settings,
        });
        const merged = mergeIdentityUniverse(stripped.next);
        set({
          companies: merged.companies,
          snapshots: merged.snapshots,
          universes: merged.universes,
          watchlist: merged.watchlist,
          audit: merged.audit,
        });
      },
      purgeFakeDemo: () => {
        const stripped = stripDemoFromWorkspace({
          companies: get().companies,
          snapshots: get().snapshots,
          universes: get().universes,
          watchlist: get().watchlist,
          audit: get().audit,
          settings: get().settings,
        });
        set({
          companies: stripped.next.companies,
          snapshots: stripped.next.snapshots,
          universes: stripped.next.universes,
          watchlist: stripped.next.watchlist,
          audit: stripped.next.audit,
        });
      },
      resetSamples: () => {
        get().purgeFakeDemo();
        get().seedIdentityUniverse();
        void (async () => {
          const { cleanupDemoDataFn } = await import("./persist/actions.ts");
          await cleanupDemoDataFn();
          await persistWorkspaceOnly();
        })();
      },
      clearAll: () => {
        set({
          companies: [],
          snapshots: [],
          universes: [],
          watchlist: [],
          audit: [],
        });
        void replaceWorkspaceOnServer();
      },
      upsertCompany: (incoming) => {
        const existing = get().companies.find(
          (c) => c.ticker.toUpperCase() === incoming.ticker.toUpperCase(),
        );
        if (existing) {
          const merged: Company = {
            ...existing,
            ...incoming,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
            seedTag: incoming.seedTag ?? existing.seedTag,
            testProfile: incoming.testProfile ?? existing.testProfile,
            sample: incoming.sample ?? existing.sample,
            cohort: incoming.cohort ?? existing.cohort,
          };
          set({ companies: get().companies.map((c) => (c.id === existing.id ? merged : c)) });
          return merged;
        }
        const created = { ...incoming, id: incoming.id || uid("c") };
        set({ companies: [...get().companies, created] });
        return created;
      },
      saveFromQuote: (company, quote, pack) => {
        const snap = runSnapshot({
          company,
          quote,
          pack: pack ?? emptyPack(),
          researchPriorityOn: get().settings.researchPriorityOn,
        });
        set({ snapshots: [...get().snapshots, snap] });
        void persistRecord(company, snap);
        return snap;
      },
      saveFromDraft: (company, draft, pack) => {
        void pack;
        const snap = runSnapshotFromDraft({
          company,
          draft,
          researchPriorityOn: get().settings.researchPriorityOn,
        });
        set({ snapshots: [...get().snapshots, snap] });
        void persistRecord(company, snap);
        return snap;
      },
      refreshCompany: (companyId) => {
        const company = get().companies.find((c) => c.id === companyId);
        const prev = latestSnapshot(get().snapshots, companyId);
        if (!company || !prev) return null;
        const fallbackClone = () => {
          const draft = snapshotToDraft(prev, company);
          const snap = runSnapshotFromDraft({
            company,
            draft,
            asOf: new Date().toISOString(),
            researchPriorityOn: get().settings.researchPriorityOn,
          });
          set({ snapshots: [...get().snapshots, snap] });
          void persistRecord(company, snap);
          return snap;
        };
        const run = async () => {
          try {
            const { researchTicker } = await import("./research/ticker.ts");
            const res = await researchTicker({
              data: { ticker: company.ticker, useAi: get().settings.useAi },
            });
            if (res.ok) return get().saveFromDraft(company, res.draft);
          } catch {
            // keep previous; still insert a new snapshot
          }
          return fallbackClone();
        };
        return run();
      },
      hydrateFromDb: (data) => {
        const stripped = stripDemoFromWorkspace({
          companies: data.companies,
          snapshots: data.snapshots,
          universes: data.universes,
          watchlist: data.watchlist,
          audit: data.audit,
          settings: data.settings ?? get().settings,
        });
        set({
          companies: stripped.next.companies,
          snapshots: stripped.next.snapshots,
          universes: stripped.next.universes,
          watchlist: stripped.next.watchlist,
          audit: stripped.next.audit,
          settings: data.settings ? { ...get().settings, ...data.settings } : get().settings,
        });
      },
      overrideXFactor: (snapshotId, code, score, reason) => {
        const snap = get().snapshots.find((s) => s.id === snapshotId);
        if (!snap) return;
        const factors = snap.xbagger.factors.map((f) =>
          f.code === code
            ? { ...f, score, reason: `Override: ${reason}`, status: "OVERRIDE" as const, confidence: "High" as const }
            : { code: f.code, score: f.score, reason: f.reason, confidence: f.confidence, evidenceIds: f.evidenceIds, override: f.status === "OVERRIDE" },
        );
        const x = scoreXBagger({
          factors: snap.xbagger.factors.map((f) => ({
            code: f.code,
            score: f.code === code ? score : f.score,
            reason: f.code === code ? `Override: ${reason}` : f.reason,
            confidence: f.confidence,
            evidenceIds: f.evidenceIds,
            override: f.code === code || f.status === "OVERRIDE",
          })),
          tenxMath: snap.xbagger.tenxMath,
          tenxScenarios: snap.xbagger.tenxScenarios,
          tenxFeasibility: snap.xbagger.tenxFeasibility,
        });
        const lenses = scoreLenses({ m: snap.derived, x, o: snap.oversold, q: snap.quality });
        const tags = strategyTags(x, snap.oversold, snap.quality);
        const rp = researchPriority({
          x,
          o: snap.oversold,
          q: snap.quality,
          lenses,
          enabled: get().settings.researchPriorityOn,
        });
        const next: Snapshot = {
          ...snap,
          id: uid("snap"),
          createdAt: new Date().toISOString(),
          xbagger: x,
          lenses,
          tags,
          researchPriority: rp?.score ?? null,
          researchPriorityParts: rp?.parts ?? null,
        };
        const log: AuditLog = {
          id: uid("aud"),
          engine: "xbagger",
          modelVersion: x.version,
          factorId: code,
          snapshotId: next.id,
          oldValue: snap.xbagger.factors.find((f) => f.code === code)?.score ?? null,
          newValue: score,
          reason,
          userOverride: true,
          timestamp: next.createdAt,
        };
        void factors;
        set({
          snapshots: [...get().snapshots, next],
          audit: [...get().audit, log],
        });
        void persistRecord(
          get().companies.find((c) => c.id === next.companyId) ?? {
            id: next.companyId,
            ticker: "",
            exchange: "",
            companyName: "",
            country: "",
            sector: "",
            industry: "",
            createdAt: next.createdAt,
            updatedAt: next.createdAt,
          },
          next,
        );
      },
      toggleWatch: (companyId) => {
        const w = get().watchlist;
        set({
          watchlist: w.includes(companyId) ? w.filter((id) => id !== companyId) : [...w, companyId],
        });
      },
      importJson: (data) => {
        set({
          companies: data.companies ?? get().companies,
          snapshots: data.snapshots ?? get().snapshots,
          universes: data.universes ?? get().universes,
          watchlist: data.watchlist ?? get().watchlist,
          settings: { ...get().settings, ...data.settings },
        });
      },
      updateSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      createUniverse: (name, market, tickers) => {
        const u: Universe = {
          id: uid("u"),
          name,
          version: 1,
          market,
          status: "open",
          createdAt: new Date().toISOString(),
          lockedAt: null,
          tickers,
        };
        set({ universes: [...get().universes, u] });
        return u;
      },
      importUniverseText: (name, market, text) => {
        const parsed = parseTickerList(text);
        if (parsed.tickers.length === 0) {
          throw new Error(parsed.errors[0] ?? "가져올 티커가 없습니다");
        }
        if (parsed.errors.length) {
          throw new Error(`가져오기 중단: ${parsed.errors[0]}`);
        }
        return get().createUniverse(name, market, parsed.tickers);
      },
      lockUniverse: (id) => {
        set({
          universes: get().universes.map((u) =>
            u.id === id && u.status === "open"
              ? { ...u, status: "locked", lockedAt: new Date().toISOString() }
              : u,
          ),
        });
      },
      unlockUniverse: (id) => {
        set({
          universes: get().universes.map((u) =>
            u.id === id ? { ...u, status: "open", lockedAt: null, version: u.version + 1 } : u,
          ),
        });
      },
      archiveUniverse: (id) => {
        set({
          universes: get().universes.map((u) => (u.id === id ? { ...u, status: "archived" } : u)),
        });
      },
      retryPersist: () => {
        retryPersist();
      },
    }),
    {
      name: "idt-v21-prefs",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistChain: Promise<void> = Promise.resolve();
let lastFailed: { company: Company; snap: Snapshot } | null = null;

function workspaceDump() {
  const s = useAppStore.getState();
  return {
    companies: s.companies,
    snapshots: s.snapshots,
    universes: s.universes,
    watchlist: s.watchlist,
    audit: s.audit,
    settings: s.settings,
  };
}

export function schedulePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const s = useAppStore.getState();
    if (!s.hydrated) return;
    void persistWorkspaceOnly();
  }, 800);
}

async function persistWorkspaceOnly() {
  if (typeof window === "undefined") return;
  const { persistWorkspaceFn } = await import("./persist/actions.ts");
  await persistWorkspaceFn({ data: workspaceDump() });
}

function setPersistState(status: PersistStatus, error: string | null = null) {
  useAppStore.setState({ persistStatus: status, persistError: error });
}

function persistRecord(company: Company, snap: Snapshot) {
  if (typeof window === "undefined") return;
  persistChain = persistChain.then(async () => {
    setPersistState("SAVING");
    try {
      const { saveAnalysisTransactionFn } = await import("./persist/actions.ts");
      await saveAnalysisTransactionFn({ data: { company, snapshot: snap } });
      lastFailed = null;
      setPersistState("SAVED");
    } catch (err) {
      lastFailed = { company, snap };
      const message = err instanceof Error ? err.message : String(err);
      setPersistState("SAVE_FAILED", message);
    }
  });
}

export function retryPersist() {
  if (!lastFailed) return;
  const { company, snap } = lastFailed;
  persistRecord(company, snap);
}

export async function flushPersist() {
  if (typeof window === "undefined") return;
  await persistChain;
  const s = useAppStore.getState();
  if (!s.hydrated) return;
  await persistWorkspaceOnly();
}

async function replaceWorkspaceOnServer() {
  if (typeof window === "undefined") return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const { clearWorkspaceFn, persistWorkspaceFn } = await import("./persist/actions.ts");
  await clearWorkspaceFn();
  await persistWorkspaceFn({ data: workspaceDump() });
}

if (typeof window !== "undefined") {
  useAppStore.subscribe(() => schedulePersist());
}

export function latestSnapshot(snapshots: Snapshot[], companyId: string): Snapshot | undefined {
  return snapshots
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => b.asOf.localeCompare(a.asOf) || b.createdAt.localeCompare(a.createdAt))[0];
}

export function snapshotsFor(snapshots: Snapshot[], companyId: string): Snapshot[] {
  return snapshots
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
