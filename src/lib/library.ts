import { SAMPLE_RESEARCH_100 } from "./sample-research-100.ts";
import type { Company } from "./types.ts";

/** Identity-only view of the original 40 US screener names. Never emits scores. */
export function buildLibraryIdentities(): Company[] {
  return SAMPLE_RESEARCH_100.filter((c) => c.testProfile === "US_SCREENER").map((c) => ({ ...c }));
}
