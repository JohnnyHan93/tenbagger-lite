import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { FACTOR_META, type FactorCode } from "../scoring/config.ts";

export type GapImpact = "HIGH" | "MEDIUM" | "LOW";

export interface ResearchGap {
  rank: number;
  field: string;
  engine: "xbagger" | "oversold" | "quality";
  factor?: string;
  impact: GapImpact;
  reason: string;
  nextSource: string;
}

function nextSource(company: Company | undefined, engine: ResearchGap["engine"]): string {
  const kr = company?.country === "KR";
  if (engine === "quality") {
    return kr
      ? "DART 사업보고서 · WiseReport IFRS연결 연간 · 회사 IR"
      : "10-K / 10-Q · Nasdaq financials · company IR";
  }
  if (engine === "oversold") {
    return kr ? "Naver 시세·PBR · WiseReport 연간" : "Nasdaq quote · 52-week range · filings";
  }
  return kr ? "DART · 회사 IR · 고객/파트너 공식 공시" : "SEC filings · IR · official customer disclosures";
}

const X_IMPACT: Partial<Record<FactorCode, GapImpact>> = {
  F1: "HIGH",
  F2: "HIGH",
  F6: "HIGH",
  F7: "HIGH",
  F10: "HIGH",
  F3: "MEDIUM",
  F4: "MEDIUM",
  F5: "MEDIUM",
  F8: "MEDIUM",
  F9: "LOW",
};

export function buildResearchGaps(snapshot: Snapshot, company?: Company): ResearchGap[] {
  const items: Omit<ResearchGap, "rank">[] = [];
  for (const f of snapshot.xbagger.factors) {
    if (f.score != null) continue;
    const code = f.code as FactorCode;
    items.push({
      field: FACTOR_META[code]?.nameKo ?? f.name,
      engine: "xbagger",
      factor: f.id,
      impact: X_IMPACT[code] ?? "MEDIUM",
      reason: f.reason || "증거 없음",
      nextSource: nextSource(company, "xbagger"),
    });
  }
  if (snapshot.oversold.fundamental == null) {
    items.push({
      field: "Oversold Fundamental",
      engine: "oversold",
      factor: "FUND",
      impact: "HIGH",
      reason: snapshot.oversold.reasons.fundamental,
      nextSource: nextSource(company, "oversold"),
    });
  }
  if (snapshot.oversold.valuation == null) {
    items.push({
      field: "Oversold Valuation",
      engine: "oversold",
      factor: "VAL",
      impact: "MEDIUM",
      reason: snapshot.oversold.reasons.valuation,
      nextSource: nextSource(company, "oversold"),
    });
  }
  if (snapshot.oversold.oversold == null) {
    items.push({
      field: "52w drawdown",
      engine: "oversold",
      factor: "OS",
      impact: "MEDIUM",
      reason: snapshot.oversold.reasons.oversold,
      nextSource: nextSource(company, "oversold"),
    });
  }
  for (const f of snapshot.quality.factors) {
    if (f.status !== "NA" || f.applicability === "N" || f.applicability === "R") continue;
    if (f.kind === "Diagnostic") continue;
    items.push({
      field: f.name,
      engine: "quality",
      factor: f.id,
      impact: f.kind === "Core" ? "HIGH" : "MEDIUM",
      reason: f.reason,
      nextSource: nextSource(company, "quality"),
    });
  }
  const rankOf = (g: Omit<ResearchGap, "rank">) =>
    (g.impact === "HIGH" ? 30 : g.impact === "MEDIUM" ? 20 : 10) + (g.engine === "xbagger" ? 3 : g.engine === "quality" ? 2 : 1);
  return items
    .sort((a, b) => rankOf(b) - rankOf(a))
    .slice(0, 12)
    .map((g, i) => ({ ...g, rank: i + 1 }));
}

export function highestImpactGap(snapshot: Snapshot, company?: Company): ResearchGap | null {
  return buildResearchGaps(snapshot, company)[0] ?? null;
}
