import {
  FACTOR_META,
  FACTOR_ORDER,
  VERDICT_BY_GRADE,
  type FactorCode,
  type Grade,
  type TenxFeasibility,
  type Verdict,
} from "../scoring/config.ts";
import { applyCoverage, weightedObserved } from "./coverage.ts";
import { getCriteria } from "./criteria/active.ts";
import type { XBaggerCriteria } from "./criteria/types.ts";
import { f10FromMath } from "../tenx/calculator.ts";
import type { TenxMath, TenxScenario } from "../types.ts";

export const XBG_VERSION = "XBG-v2.3";
