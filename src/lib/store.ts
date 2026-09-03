import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSampleWorld } from "./samples.ts";
import { runSnapshot } from "./engines/run.ts";
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

export interface AppState {
  hydrated: boolean;
  companies: Company[];
  snapshots: Snapshot[];
  universes: Universe[];
  watchlist: string[];
  audit: AuditLog[];
  settings: AppSettings;
  setHydrated: (v: boolean) => void;
  seedIfEmpty: () => void;
  resetSamples: () => void;
  clearAll: () => void;
  upsertCompany: (c: Company) => Company;
  saveFromQuote: (company: Company, quote: ResearchQuote, pack?: ResearchPack) => Snapshot;
  saveFromDraft: (company: Company, draft: ResearchDraft, pack?: ResearchPack) => Snapshot;
  overrideXFactor: (snapshotId: string, code: FactorCode, score: number, reason: string) => void;
  toggleWatch: (companyId: string) => void;
  importJson: (data: Partial<Pick<AppState, "companies" | "snapshots" | "universes" | "watchlist" | "settings">>) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  createUniverse: (name: string, market: Universe["market"], tickers: UniverseTicker[]) => Universe;
  importUniverseText: (name: string, market: Universe["market"], text: string) => Universe;
  lockUniverse: (id: string) => void;
  unlockUniverse: (id: string) => void;
  archiveUniverse: (id: string) => void;
}

const emptySettings: AppSettings = {
  defaultResearchMode: "auto",
  useAi: true,
  researchPriorityOn: true,
  qualityModel: "MFC70-v1.1",
};

function sampleState() {
  const world = buildSampleWorld();
  return {
    companies: world.companies,
    snapshots: world.snapshots,
    universes: [
      {
        id: "u_sample",
        name: "Sample Six (fixtures)",
        version: 1,
        market: "GLOBAL" as const,
        status: "open" as const,
        createdAt: "2026-09-03T00:00:00.000Z",
        lockedAt: null,
        tickers: world.companies.map((c) => ({ ticker: c.ticker, name: c.companyName })),
      },
    ],
    watchlist: world.companies.map((c) => c.id),
    audit: [] as AuditLog[],
    settings: emptySettings,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...sampleState(),
      setHydrated: (v) => set({ hydrated: v }),
      seedIfEmpty: () => {
        if (get().companies.length === 0) set(sampleState());
      },
      resetSamples: () => set(sampleState()),
      clearAll: () =>
        set({
          companies: [],
          snapshots: [],
          universes: [],
          watchlist: [],
          audit: [],
        }),
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
        return snap;
      },
      saveFromDraft: (company, draft, pack) => {
        return get().saveFromQuote(company, draft.quote, pack);
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
    }),
    {
      name: "idt-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        companies: s.companies,
        snapshots: s.snapshots,
        universes: s.universes,
        watchlist: s.watchlist,
        audit: s.audit,
        settings: s.settings,
      }),
    },
  ),
);

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
