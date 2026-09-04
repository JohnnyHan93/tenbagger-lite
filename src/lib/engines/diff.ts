import type { Snapshot } from "../domain/snapshot.ts";

export interface FactorChange {
  engine: "xbagger" | "oversold" | "quality";
  id: string;
  from: number | null;
  to: number | null;
}

export interface SnapshotDiff {
  previousId: string;
  nextId: string;
  scoreDelta: { xbagger: number | null; oversold: number | null; quality: number | null };
  coverageDelta: { xbagger: number; oversold: number; quality: number; overall: number };
  confidenceDelta: { from: Snapshot["overallConfidence"]; to: Snapshot["overallConfidence"] };
  factorChanges: FactorChange[];
  evidenceAdded: string[];
  evidenceInvalidated: string[];
}

function numDelta(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  return b - a;
}

export function diffSnapshots(previous: Snapshot, next: Snapshot): SnapshotDiff {
  const factorChanges: FactorChange[] = [];
  const prevX = new Map(previous.xbagger.factors.map((f) => [f.id, f.score]));
  for (const f of next.xbagger.factors) {
    const from = prevX.get(f.id) ?? null;
    if (from !== f.score) factorChanges.push({ engine: "xbagger", id: f.id, from, to: f.score });
  }
  const prevQ = new Map(previous.quality.factors.map((f) => [f.id, f.score]));
  for (const f of next.quality.factors) {
    const from = prevQ.get(f.id) ?? null;
    if (from !== f.score) factorChanges.push({ engine: "quality", id: f.id, from, to: f.score });
  }
  if (previous.oversold.opportunity !== next.oversold.opportunity) {
    factorChanges.push({
      engine: "oversold",
      id: "OPP",
      from: previous.oversold.opportunity,
      to: next.oversold.opportunity,
    });
  }

  const prevEv = new Set(previous.evidence.map((e) => e.id));
  const nextEv = new Set(next.evidence.map((e) => e.id));
  const evidenceAdded = [...nextEv].filter((id) => !prevEv.has(id));
  const dropped = [...prevEv].filter((id) => !nextEv.has(id));
  const invalidated = next.evidence.filter((e) => e.status === "INVALIDATED").map((e) => e.id);

  return {
    previousId: previous.id,
    nextId: next.id,
    scoreDelta: {
      xbagger: numDelta(previous.xbagger.adjustedScore, next.xbagger.adjustedScore),
      oversold: numDelta(previous.oversold.opportunity, next.oversold.opportunity),
      quality: numDelta(previous.quality.score, next.quality.score),
    },
    coverageDelta: {
      xbagger: next.xbagger.coverage - previous.xbagger.coverage,
      oversold: next.oversold.coverage - previous.oversold.coverage,
      quality: next.quality.coverage - previous.quality.coverage,
      overall: next.overallCoverage - previous.overallCoverage,
    },
    confidenceDelta: { from: previous.overallConfidence, to: next.overallConfidence },
    factorChanges,
    evidenceAdded,
    evidenceInvalidated: [...new Set([...dropped, ...invalidated])],
  };
}
