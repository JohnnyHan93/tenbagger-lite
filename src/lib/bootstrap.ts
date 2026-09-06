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

function mergeCompanyFields(kept: Company, other: Company): Company {
  return {
    ...other,
    ...kept,
    id: kept.id,
    createdAt: kept.createdAt <= other.createdAt ? kept.createdAt : other.createdAt,
    updatedAt: kept.updatedAt >= other.updatedAt ? kept.updatedAt : other.updatedAt,
    sector: kept.sector || other.sector,
    industry: kept.industry || other.industry,
    exchange: kept.exchange || other.exchange,
    companyName: kept.companyName || other.companyName,
    country: kept.country || other.country,
    seedTag: kept.seedTag ?? other.seedTag,
    testProfile: kept.testProfile ?? other.testProfile,
    sample: Boolean(kept.sample && other.sample),
  };
}

/**
 * Union two workspaces. Same ticker keeps the company id that already has
 * analyses. Snapshots/watchlist ids are remapped. Never drops a researched name
 * just because the other side is an identity-only shell.
 */
export function mergeWorkspaces(local: WorkspaceSlice, remote: WorkspaceSlice): WorkspaceSlice {
  const allSnaps = [...local.snapshots, ...remote.snapshots];
  const snapCount = (companyId: string) => allSnaps.filter((s) => s.companyId === companyId).length;
  const byTicker = new Map<string, Company>();
  const idRemap = new Map<string, string>();

  for (const c of [...local.companies, ...remote.companies]) {
    const key = c.ticker.trim().toUpperCase();
    if (!key) continue;
    const prev = byTicker.get(key);
    if (!prev) {
      byTicker.set(key, c);
      continue;
    }
    if (prev.id === c.id) {
      byTicker.set(key, mergeCompanyFields(prev, c));
      continue;
    }
    const keepPrev = snapCount(prev.id) >= snapCount(c.id);
    const kept = keepPrev ? prev : c;
    const dropped = keepPrev ? c : prev;
    idRemap.set(dropped.id, kept.id);
    byTicker.set(key, mergeCompanyFields(kept, dropped));
  }

  const remapId = (id: string) => idRemap.get(id) ?? id;
  const seenSnap = new Set<string>();
  const snapshots: Snapshot[] = [];
  for (const snap of allSnaps) {
    if (seenSnap.has(snap.id)) continue;
    seenSnap.add(snap.id);
    snapshots.push({ ...snap, companyId: remapId(snap.companyId) });
  }

  const universeById = new Map<string, Universe>();
  for (const u of [...remote.universes, ...local.universes]) {
    const prev = universeById.get(u.id);
    if (!prev) {
      universeById.set(u.id, u);
      continue;
    }
    const tickers = [...prev.tickers];
    const seen = new Set(tickers.map((t) => t.ticker.toUpperCase()));
    for (const t of u.tickers) {
      const k = t.ticker.toUpperCase();
      if (seen.has(k)) continue;
      seen.add(k);
      tickers.push(t);
    }
    universeById.set(u.id, {
      ...prev,
      ...u,
      tickers,
      version: Math.max(prev.version, u.version),
      lockedAt: u.lockedAt ?? prev.lockedAt,
    });
  }

  const keepIds = new Set([...byTicker.values()].map((c) => c.id));
  const watchSeen = new Set<string>();
  const watchlist: string[] = [];
  for (const id of [...local.watchlist, ...remote.watchlist]) {
    const mapped = remapId(id);
    if (!keepIds.has(mapped) || watchSeen.has(mapped)) continue;
    watchSeen.add(mapped);
    watchlist.push(mapped);
  }

  const auditById = new Map<string, AuditLog>();
  for (const a of [...remote.audit, ...local.audit]) auditById.set(a.id, a);

  return {
    companies: [...byTicker.values()],
    snapshots,
    universes: [...universeById.values()],
    watchlist,
    audit: [...auditById.values()],
    settings: { ...EMPTY_SETTINGS, ...remote.settings, ...local.settings },
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
