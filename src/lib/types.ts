import type {
  Confidence,
  EvidenceType,
  FactorCode,
  FlagStatus,
  FlagType,
  GateResult,
  Grade,
  HandoffStatus,
  TenxFeasibility,
  TenxPath,
  Verdict,
} from "./scoring/config.ts";


export type Currency = "USD" | "KRW";

export interface Company {
  id: string;
  ticker: string;
  exchange: string;
  companyName: string;
  country: string;
  sector: string;
  industry: string;
  cohort?: "priority" | "conditional" | "sample";
  createdAt: string;
  updatedAt: string;
}

export interface FactorScore {
  factorCode: FactorCode;
  score: number | null;
  weight: number;
  weightedScore: number | null;
  evidenceSummary: string;
  found?: string;
  benchmark?: string;
  confidence: Confidence;
  originalScore: number | null;
  overrideScore: number | null;
  overrideReason: string | null;
  overrideDate: string | null;
}

export interface Evidence {
  id: string;
  factorCode: FactorCode | "GENERAL";
  evidence: string;
  evidenceType: EvidenceType;
  sourceName: string;
  sourceUrl: string;
  sourceDate: string;
  confidence: number;
  createdAt: string;
}

export interface RedFlag {
  flagType: FlagType;
  status: FlagStatus;
  reason: string;
  penalty: number;
  hardStop: boolean;
}

export interface HardGates {
  tenx: GateResult;
  survival: GateResult;
  customer: GateResult;
  evidence: GateResult;
}

export interface TenxScenario {
  scenario: "BEAR" | "BASE" | "BULL";
  revenue: number;
  operatingMargin: number;
  netMargin: number;
  netIncome: number;
  multipleType: "PE" | "EV_SALES";
  multipleValue: number;
  impliedMarketCap: number;
  upsideMultiple: number;
}

export interface TenxMath {
  currentMarketCap: number;
  targetMarketCap: number;
  currentRevenue: number | null;
  assumedCagr: number | null;
  revenue5y: number | null;
  revenue7y: number | null;
  matureMargin: number;
  exitMultiple: number;
  impliedFutureMarketCap: number | null;
  impliedMultipleVsToday: number | null;
  path: TenxPath;
}

export interface FinancialSnapshot {
  revenueTtm: number | null;
  revenuePrior: number | null;
  operatingIncomeTtm: number | null;
  netIncomeTtm: number | null;
  cash: number | null;
  totalDebt: number | null;
  sharesOutstanding: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  fcf: number | null;
}

export interface Analysis {
  id: string;
  companyId: string;
  analysisDate: string;
  price: number;
  marketCap: number;
  enterpriseValue: number;
  currency: Currency;
  financials: FinancialSnapshot;
  factorScores: FactorScore[];
  factorTotal: number;
  rawScore: number;
  adjustedScore: number;
  grade: Grade;
  verdict: Verdict;
  tenxFeasibility: TenxFeasibility;
  redFlags: RedFlag[];
  hardGates: HardGates;
  hardStop: boolean;
  tenxScenarios: TenxScenario[];
  tenxMath: TenxMath;
  requiredRevenue: number | null;
  requiredNetIncome: number | null;
  requiredMarketShare: number | null;
  requiredPe: number | null;
  requiredEvSales: number | null;
  oneSentenceThesis: string;
  thesisGate: "PASS" | "FAIL";
  catalysts: string[];
  risks: string[];
  nextProof: string[];
  killCriteria: string[];
  quarterlyKpis: string[];
  evidences: Evidence[];
  findings?: Array<{ label: string; value: string }>;
  overallConfidence: Confidence;
  scoringVersion: string;
  researchProvider: string;
  createdAt: string;
}

export interface MasterHandoff {
  id: string;
  analysisId: string;
  companyId: string;
  status: HandoffStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  defaultResearchMode: "auto" | "manual";
  useAi: boolean;
}

export interface ResearchQuote {
  ticker: string;
  exchange: string;
  companyName: string;
  currency: Currency;
  price: number;
  marketCap: number;
  enterpriseValue: number;
  country: string;
  sector: string;
  industry: string;
  financials: FinancialSnapshot;
}

export interface DraftFactor {
  code: FactorCode;
  score: number | null;
  summary: string;
  found?: string;
  benchmark?: string;
  confidence?: Confidence;
}

export interface ResearchDraft {
  quote: ResearchQuote;
  factors: DraftFactor[];
  redFlags: RedFlag[];
  tenxScenarios: TenxScenario[];
  tenxMath?: TenxMath;
  requiredRevenue: number | null;
  requiredNetIncome: number | null;
  requiredPe: number | null;
  requiredEvSales: number | null;
  tenxFeasibility: TenxFeasibility;
  catalysts: string[];
  risks: string[];
  nextProof: string[];
  killCriteria: string[];
  quarterlyKpis?: string[];
  thesis: string;
  evidences: Evidence[];
  findings?: Array<{ label: string; value: string }>;
  researchProvider: string;
}
