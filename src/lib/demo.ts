/** FAKE_DEMO vs TEST_FIXTURE vs real research. Runtime bootstrap must never insert FAKE_DEMO. */

export type DataClass =
  | "FAKE_DEMO"
  | "TEST_FIXTURE"
  | "REAL_USER_DATA"
  | "REAL_RESEARCH_DATA"
  | "SYSTEM_CONFIG";

export const ORIGINAL_GROK_SAMPLE_TAG = "ORIGINAL_GROK_SAMPLE";
export const SAMPLE_RESEARCH_100_TAG = "IDT_SAMPLE_RESEARCH_100";

const FAKE_NAME_RE =
  /\(SAMPLE\)|Northline Software|Harbor Brands|Redridge Materials|에코반도체장비|한강생활|서해모빌리티/i;

const FAKE_TICKER_RE = /^SMPL-/i;
const FAKE_ID_RE = /^c_smpl_/i;

const SEED_HEURISTIC_PROVIDERS = new Set(["quote+heuristic", "filings+profile"]);
const LIBRARY_SEED_ASOF_PREFIX = "2026-09-03";

export const FAKE_DEMO_UNIVERSE_IDS = new Set(["u_sample", "u_screener40"]);
export const FAKE_DEMO_UNIVERSE_NAMES = new Set(["sample six (fixtures)", "screener 40"]);

export interface DemoCompanyLike {
  id?: string;
  ticker?: string;
  companyName?: string;
  sample?: boolean;
  cohort?: string;
  seedTag?: string;
}

export interface DemoSnapshotLike {
  id?: string;
  companyId?: string;
  sample?: boolean;
  asOf?: string;
  createdAt?: string;
  researchProvider?: string;
}

export interface DemoUniverseLike {
  id?: string;
  name?: string;
}

export function isFakeDemoCompany(c: DemoCompanyLike | null | undefined): boolean {
  if (!c) return false;
  if (c.seedTag === ORIGINAL_GROK_SAMPLE_TAG) return true;
  if (c.sample === true) return true;
  if (c.cohort === "sample") return true;
  if (c.id && FAKE_ID_RE.test(c.id)) return true;
  if (c.ticker && FAKE_TICKER_RE.test(c.ticker)) return true;
  if (c.companyName && FAKE_NAME_RE.test(c.companyName)) return true;
  return false;
}

export function isFakeDemoUniverse(u: DemoUniverseLike | null | undefined): boolean {
  if (!u) return false;
  if (u.id && FAKE_DEMO_UNIVERSE_IDS.has(u.id)) return true;
  if (u.name && FAKE_DEMO_UNIVERSE_NAMES.has(u.name.trim().toLowerCase())) return true;
  return false;
}

export function isAutoSeededHeuristicSnapshot(s: DemoSnapshotLike | null | undefined): boolean {
  if (!s) return false;
  const provider = s.researchProvider ?? "";
  if (!SEED_HEURISTIC_PROVIDERS.has(provider)) return false;
  const stamp = s.asOf || s.createdAt || "";
  return stamp.startsWith(LIBRARY_SEED_ASOF_PREFIX);
}

export function isFakeDemoSnapshot(
  s: DemoSnapshotLike | null | undefined,
  company?: DemoCompanyLike | null,
): boolean {
  if (!s) return false;
  if (s.sample === true) return true;
  if (s.id && /^snap_c_smpl_/.test(s.id)) return true;
  if (company && isFakeDemoCompany(company)) return true;
  if (isAutoSeededHeuristicSnapshot(s)) return true;
  return false;
}

export function classifyCompany(c: DemoCompanyLike): DataClass {
  if (isFakeDemoCompany(c)) return "FAKE_DEMO";
  if (c.seedTag === SAMPLE_RESEARCH_100_TAG) return "REAL_RESEARCH_DATA";
  return "REAL_USER_DATA";
}
