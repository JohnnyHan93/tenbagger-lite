import { DEFAULT_CRITERIA } from "./defaults.ts";
import type { CriteriaPack } from "./types.ts";

let active: CriteriaPack = DEFAULT_CRITERIA;

export function getCriteria(): CriteriaPack {
  return active;
}

export function setActiveCriteria(pack: CriteriaPack): CriteriaPack {
  active = pack;
  return active;
}

export function resetActiveCriteria(): CriteriaPack {
  active = DEFAULT_CRITERIA;
  return active;
}

export function isBuiltinCriteria(): boolean {
  return active.overlayId === "builtin";
}
