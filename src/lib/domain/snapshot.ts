import type { Currency, Evidence, FinancialSnapshot, TenxMath, TenxScenario } from "../types.ts";
import type { StrategyTag } from "../engines/matrix.ts";
import type { LensResult } from "../engines/lenses.ts";
import type { OversoldResult } from "../engines/oversold.ts";
import type { QualityResult } from "../engines/quality.ts";
import type { XBaggerResult } from "../engines/xbagger.ts";
import type { DerivedMetrics } from "../metrics/derived.ts";
import type { UniverseTicker } from "../universe/parse.ts";

export interface Company {
  id: string;
  ticker: string;
  exchange: string;
  companyName: string;
  country: string;
  sector: string;
  industry: string;
  sample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  companyId: string;
  asOf: string;
  createdAt: string;
  sample?: boolean;
  price: number;
  marketCap: number;
  enterpriseValue: number;
  currency: Currency;
  financials: FinancialSnapshot;
  derived: DerivedMetrics;
  evidence: Evidence[];
  xbagger: XBaggerResult;
  oversold: OversoldResult;
  quality: QualityResult;
  lenses: LensResult[];
  tags: StrategyTag[];
  researchPriority: number | null;
  researchPriorityParts: { relevance: number; gap: number; upside: number } | null;
  oneSentenceThesis: string;
  catalysts: string[];
  risks: string[];
  nextProof: string[];
  killCriteria: string[];
  findings: Array<{ label: string; value: string }>;
  overallCoverage: number;
  overallConfidence: "High" | "Medium" | "Low";
  researchProvider: string;
  tenxMath: TenxMath | null;
  tenxScenarios: TenxScenario[];
}

export interface Universe {
  id: string;
  name: string;
  version: number;
  market: "US" | "KR" | "GLOBAL";
  status: "open" | "locked" | "archived";
  createdAt: string;
  lockedAt: string | null;
  tickers: UniverseTicker[];
}

export interface QueueItem {
  id: string;
  companyId: string;
  ticker: string;
  factor: string;
  engine: "xbagger" | "oversold" | "quality";
  reason: string;
  priority: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  engine: string;
  modelVersion: string;
  factorId: string;
  snapshotId: string;
  oldValue: number | null;
  newValue: number | null;
  reason: string;
  userOverride: boolean;
  timestamp: string;
}

export interface AppSettings {
  defaultResearchMode: "auto" | "manual";
  useAi: boolean;
  researchPriorityOn: boolean;
  qualityModel: "MFC70-v1.1" | "MFC74-v3.0";
}
