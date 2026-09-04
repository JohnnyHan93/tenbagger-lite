import {
  isFakeDemoCompany,
  isFakeDemoSnapshot,
  isFakeDemoUniverse,
} from "./demo.ts";
import {
  SAMPLE_RESEARCH_100,
  sampleResearch100Stats,
  sampleResearch100Universe,
} from "./sample-research-100.ts";
import type { AppSettings, AuditLog, Snapshot, Universe } from "./domain/snapshot.ts";
import type { Company } from "./types.ts";

export interface WorkspaceSlice {
  companies: Company[];
  snapshots: Snapshot[];
  universes: Universe[];
  watchlist: string[];
  audit: AuditLog[];
  settings: AppSettings | null;
}

export const EMPTY_SETTINGS: AppSettings = {
  defaultResearchMode: "auto",
  useAi: true,
  researchPriorityOn: true,
  qualityModel: "MFC70-v1.2",
};

export interface StripDemoReport {
  companiesRemoved: number;
  analysesRemoved: number;
  universesRemoved: number;
  watchlistRemoved: number;
  logsRemoved: number;
  realUserRecordsAffected: number;
  fictionalRemaining: number;
}

export function emptyWorkspace(settings: AppSettings = EMPTY_SETTINGS): WorkspaceSlice {
  return {
    companies: [],
    snapshots: [],
    universes: [],
    watchlist: [],
    audit: [],
    settings,
  };
}

export function identityUniverseWorkspace(settings: AppSettings = EMPTY_SETTINGS): WorkspaceSlice {
  const companies = SAMPLE_RESEARCH_100.map((c) => ({ ...c }));
  return {
    companies,
    snapshots: [],
    universes: [sampleResearch100Universe(companies)],
    watchlist: [],
    audit: [],
    settings,
  };
}

export function stripDemoFromWorkspace(dump: WorkspaceSlice): {
  next: WorkspaceSlice;
  report: StripDemoReport;
} {
  const fakeCompanies = dump.companies.filter(isFakeDemoCompany);
  const fakeCompanyIds = new Set(fakeCompanies.map((c) => c.id));
  const companyById = new Map(dump.companies.map((c) => [c.id, c]));

  const companies = dump.companies.filter((c) => !isFakeDemoCompany(c));
  const snapshots = dump.snapshots.filter((s) => !isFakeDemoSnapshot(s, companyById.get(s.companyId)));
  const universes = dump.universes.filter((u) => !isFakeDemoUniverse(u));
  const keepCompanyIds = new Set(companies.map((c) => c.id));
  const keepSnapIds = new Set(snapshots.map((s) => s.id));
  const watchlist = dump.watchlist.filter((id) => keepCompanyIds.has(id) && !fakeCompanyIds.has(id));
  const audit = dump.audit.filter((a) => !a.snapshotId || keepSnapIds.has(a.snapshotId));

  const report: StripDemoReport = {
    companiesRemoved: dump.companies.length - companies.length,
    analysesRemoved: dump.snapshots.length - snapshots.length,
    universesRemoved: dump.universes.length - universes.length,
    watchlistRemoved: dump.watchlist.length - watchlist.length,
    logsRemoved: dump.audit.length - audit.length,
    realUserRecordsAffected: 0,
    fictionalRemaining: companies.filter(isFakeDemoCompany).length,
  };

  return {
    next: {
      companies,
      snapshots,
      universes,
      watchlist,
      audit,
      settings: dump.settings,
    },
    report,
  };
}

export function mergeIdentityUniverse(dump: WorkspaceSlice): WorkspaceSlice {
  const byTicker = new Map(dump.companies.map((c) => [c.ticker.toUpperCase(), c]));
  const companies = [...dump.companies];
  for (const ident of SAMPLE_RESEARCH_100) {
    const existing = byTicker.get(ident.ticker.toUpperCase());
    if (existing) {
      const merged: Company = {
        ...existing,
        country: ident.country,
        exchange: existing.exchange || ident.exchange,
        sector: existing.sector || ident.sector,
        industry: existing.industry || ident.industry,
        seedTag: existing.seedTag ?? ident.seedTag,
        testProfile: existing.testProfile ?? ident.testProfile,
        sample: false,
      };
      const idx = companies.findIndex((c) => c.id === existing.id);
      if (idx >= 0) companies[idx] = merged;
      byTicker.set(ident.ticker.toUpperCase(), merged);
      continue;
    }
    companies.push({ ...ident });
    byTicker.set(ident.ticker.toUpperCase(), ident);
  }

  const universes = dump.universes.filter((u) => u.id !== sampleResearch100Universe().id);
  universes.unshift(sampleResearch100Universe(SAMPLE_RESEARCH_100));

  return {
    ...dump,
    companies,
    universes,
  };
}

export function identityUniverseCounts(companies: Company[]) {
  return sampleResearch100Stats(companies);
}
