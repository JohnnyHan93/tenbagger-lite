import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSampleWorld } from "./samples";
import { buildLibraryWorld } from "./library";
import { materializeAnalysis, applyFactorOverride } from "./scoring/pipeline";
import { uid } from "./utils";
import type { FactorCode } from "./scoring/config";
import type {
  Analysis,
  AppSettings,
  Company,
  MasterHandoff,
  ResearchDraft,
} from "./types";

export interface AppState {
  hydrated: boolean;
  companies: Company[];
  analyses: Analysis[];
  handoffs: MasterHandoff[];
  watchlist: string[];
  settings: AppSettings;
  setHydrated: (v: boolean) => void;
  seedIfEmpty: () => void;
  resetSamples: () => void;
  clearAll: () => void;
  upsertCompany: (c: Company) => Company;
  saveAnalysis: (company: Company, draft: ResearchDraft) => Analysis;
  overrideFactor: (
    analysisId: string,
    code: FactorCode,
    score: number,
    reason: string,
  ) => void;
  toggleWatch: (companyId: string) => void;
  setHandoff: (companyId: string, analysisId: string, status: MasterHandoff["status"]) => void;
  importState: (data: {
    companies: Company[];
    analyses: Analysis[];
    handoffs: MasterHandoff[];
    watchlist: string[];
    settings?: AppSettings;
  }) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
}

const emptySettings: AppSettings = {
  defaultResearchMode: "auto",
  useAi: true,
};

function sampleState() {
  const world = buildSampleWorld();
  const lib = buildLibraryWorld();
  const companies = [...world.companies, ...lib.companies];
  const analyses = [...world.analyses, ...lib.analyses];
  const watchlist = [
    ...world.companies.map((c) => c.id),
    ...lib.companies.filter((c) => c.cohort === "priority").map((c) => c.id),
  ];
  return {
    companies,
    analyses,
    handoffs: world.handoffs,
    watchlist,
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
          analyses: [],
          handoffs: [],
          watchlist: [],
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
          set({
            companies: get().companies.map((c) => (c.id === existing.id ? merged : c)),
          });
          return merged;
        }
        const created: Company = {
          ...incoming,
          id: incoming.id || uid("c"),
        };
        set({ companies: [...get().companies, created] });
        return created;
      },
      saveAnalysis: (company, draft) => {
        const saved = get().upsertCompany(company);
        const analysis = materializeAnalysis(saved.id, draft);
        const watch = get().watchlist.includes(saved.id)
          ? get().watchlist
          : [...get().watchlist, saved.id];
        set({
          analyses: [...get().analyses, analysis],
          watchlist: watch,
          companies: get().companies.map((c) =>
            c.id === saved.id ? { ...c, updatedAt: analysis.createdAt } : c,
          ),
        });
        return analysis;
      },
      overrideFactor: (analysisId, code, score, reason) => {
        set({
          analyses: get().analyses.map((a) =>
            a.id === analysisId ? applyFactorOverride(a, code, score, reason) : a,
          ),
        });
      },
      toggleWatch: (companyId) => {
        const w = get().watchlist;
        set({
          watchlist: w.includes(companyId)
            ? w.filter((id) => id !== companyId)
            : [...w, companyId],
        });
      },
      setHandoff: (companyId, analysisId, status) => {
        const existing = get().handoffs.find((h) => h.companyId === companyId);
        const now = new Date().toISOString();
        if (existing) {
          set({
            handoffs: get().handoffs.map((h) =>
              h.id === existing.id
                ? { ...h, analysisId, status, updatedAt: now }
                : h,
            ),
          });
        } else {
          set({
            handoffs: [
              ...get().handoffs,
              {
                id: uid("h"),
                analysisId,
                companyId,
                status,
                createdAt: now,
                updatedAt: now,
              },
            ],
          });
        }
      },
      importState: (data) => {
        set({
          companies: data.companies,
          analyses: data.analyses,
          handoffs: data.handoffs,
          watchlist: data.watchlist,
          settings: data.settings ?? get().settings,
        });
      },
      updateSettings: (s) => set({ settings: { ...get().settings, ...s } }),
    }),
    {
      name: "tenbagger-lite-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        companies: s.companies,
        analyses: s.analyses,
        handoffs: s.handoffs,
        watchlist: s.watchlist,
        settings: s.settings,
      }),
      skipHydration: true,
    },
  ),
);

export function latestAnalysis(analyses: Analysis[], companyId: string): Analysis | undefined {
  return analyses
    .filter((a) => a.companyId === companyId)
    .sort((a, b) => b.analysisDate.localeCompare(a.analysisDate))[0];
}

export function previousAnalysis(
  analyses: Analysis[],
  companyId: string,
  currentId: string,
): Analysis | undefined {
  return analyses
    .filter((a) => a.companyId === companyId && a.id !== currentId)
    .sort((a, b) => b.analysisDate.localeCompare(a.analysisDate))[0];
}

export function scoreChange(analyses: Analysis[], companyId: string): number | null {
  const list = analyses
    .filter((a) => a.companyId === companyId)
    .sort((a, b) => b.analysisDate.localeCompare(a.analysisDate));
  if (list.length < 2) return null;
  return list[0].adjustedScore - list[1].adjustedScore;
}

export function needsRefresh(analysis: Analysis | undefined, days = 90): boolean {
  if (!analysis) return true;
  const t = new Date(analysis.analysisDate).getTime();
  return Date.now() - t > days * 86400000;
}
