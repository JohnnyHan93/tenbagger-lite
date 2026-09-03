import type { LensResult } from "./lenses.ts";
import type { OversoldResult } from "./oversold.ts";
import type { QualityResult } from "./quality.ts";
import type { XBaggerResult } from "./xbagger.ts";

export type StrategyTag =
  | "WILDCARD"
  | "QUALITY COMPOUNDER"
  | "OVERSOLD QUALITY"
  | "GARP"
  | "TURNAROUND"
  | "VALUE TRAP RISK"
  | "EARLY PROOF"
  | "RESEARCH REQUIRED"
  | "NO EDGE";

export function strategyTags(x: XBaggerResult, o: OversoldResult, q: QualityResult): StrategyTag[] {
  const tags: StrategyTag[] = [];
  const xHigh = x.adjustedScore >= 65 && x.grade !== "F";
  const qHigh = (q.score ?? 0) >= 70;
  const oHigh = (o.opportunity ?? 0) >= 6.5;
  const vtHigh = o.valueTrap >= 7;
  const research =
    x.status === "RESEARCH REQUIRED" ||
    o.status === "RESEARCH REQUIRED" ||
    q.status === "RESEARCH REQUIRED";

  if (research) tags.push("RESEARCH REQUIRED");
  if (xHigh) tags.push("WILDCARD");
  if (qHigh) tags.push("QUALITY COMPOUNDER");
  if (qHigh && oHigh) tags.push("OVERSOLD QUALITY");
  if (xHigh && qHigh) tags.push("GARP");
  if (xHigh && !qHigh) tags.push("EARLY PROOF");
  if (oHigh && !qHigh && vtHigh) tags.push("VALUE TRAP RISK");
  if (o.case === "C" && oHigh) tags.push("TURNAROUND");
  if (vtHigh) tags.push("VALUE TRAP RISK");
  if (!tags.length) tags.push("NO EDGE");
  return [...new Set(tags)];
}

export function researchPriority(input: {
  x: XBaggerResult;
  o: OversoldResult;
  q: QualityResult;
  lenses: LensResult[];
  enabled: boolean;
}): { score: number; parts: { relevance: number; gap: number; upside: number } } | null {
  if (!input.enabled) return null;
  const { x, o, q } = input;
  const relevance = Math.max(
    x.adjustedScore / 100,
    (o.opportunity ?? 0) / 10,
    (q.score ?? 0) / 100,
  );
  const gap = 1 - Math.min(x.coverage, o.coverage, q.coverage);
  const upside = x.tenxFeasibility === "HIGH" ? 1 : x.tenxFeasibility === "POSSIBLE" ? 0.7 : 0.4;
  const score = Math.round(relevance * (0.4 + 0.4 * gap + 0.2 * upside) * 100);
  return { score, parts: { relevance, gap, upside } };
}
