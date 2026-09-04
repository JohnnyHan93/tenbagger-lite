export const FRESHNESS_DEFAULTS = {
  priceValuationDays: 7,
  financialsDays: 120,
  catalystDays: 90,
  customerProofDays: 180,
  marketPositionDays: 365,
  tamMoatDays: 730,
} as const;

export type FreshnessKey = keyof typeof FRESHNESS_DEFAULTS;

export function isStale(asOfIso: string, maxDays: number, now = Date.now()): boolean {
  const t = Date.parse(asOfIso);
  if (!Number.isFinite(t)) return true;
  return now - t > maxDays * 86400000;
}
