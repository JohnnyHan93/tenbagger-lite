/** Versioned, importable scoring knobs. Engines stay separate — never summed. */

export const CRITERIA_SCHEMA = "idt-criteria-v1" as const;

export type BandStep = [threshold: number, score: number];

export interface XBaggerCriteria {
  version: string;
  weights: Record<"F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10", number>;
  gradeThresholds: { S: number; A: number; B: number; C: number; D: number };
  hardGates: { tenxMin: number; survivalMin: number; customerMin: number };
  coverage: {
    noPenalty: number;
    mild: number;
    research: number;
    mildPenalty: number;
    heavyPenalty: number;
  };
}

export interface OversoldCriteria {
  version: string;
  weights: { fundamental: number; valuation: number; oversold: number; risk: number };
  coverage: { researchBelow: number; partialBelow: number };
  classify: { caseDOversoldMax: number; caseAFundMin: number; caseBFundMin: number };
  fundamental: {
    base: number;
    revenueYoY: Array<{ gt: number; delta: number }>;
    omHigh: number;
    omHighDelta: number;
    omNegDelta: number;
    omChangeUp: number;
    omChangeUpDelta: number;
    omChangeDown: number;
    omChangeDownDelta: number;
  };
  valuation: {
    evSales: Array<{ lt: number; delta: number }>;
    peCheap: number;
    peCheapDelta: number;
    peRich: number;
    peRichDelta: number;
    pbCheap: number;
    pbCheapDelta: number;
    pbOk: number;
    pbOkDelta: number;
    pbRich: number;
    pbRichDelta: number;
    peakOm: number;
    peakPe: number;
    peakPenalty: number;
  };
  price: {
    nearHigh: number;
    nearHighScore: number;
    ddBands: Array<{ lt: number; score: number }>;
  };
  risk: {
    base: number;
    netCashDelta: number;
    ndEbitdaHigh: number;
    ndEbitdaHighDelta: number;
    dilutionHigh: number;
    dilutionHighDelta: number;
    buybackDelta: number;
    concentrationHigh: number;
    concentrationDelta: number;
    fcfNegDelta: number;
  };
  trap: {
    revenueDrop: number;
    revenueDropHits: number;
    omCompress: number;
    omCompressHits: number;
    leverage: number;
    leverageHits: number;
    dilution: number;
    dilutionHits: number;
    accrual: number;
    accrualHits: number;
    weakFund: number;
    weakFundHits: number;
  };
}

export interface QualityCriteria {
  version: string;
  gradeThresholds: { S: number; A: number; B: number; C: number; D: number };
  coverage: { researchBelow: number; partialBelow: number };
  redFlag: { redScoreMax: number; yellowHits: number; redHits: number };
  bands: Record<string, BandStep[]>;
}

export interface CriteriaPack {
  schema: typeof CRITERIA_SCHEMA;
  title: string;
  note: string;
  overlayId: string;
  appliedAt: string | null;
  engines: {
    xbagger: XBaggerCriteria;
    oversold: OversoldCriteria;
    quality70: QualityCriteria;
  };
}
