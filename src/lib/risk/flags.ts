import { flagPenalty } from "../scoring/wildcard-score.ts";
import type { FlagStatus, FlagType } from "../scoring/config.ts";
import type { RedFlag } from "../types.ts";


export function makeFlag(
  flagType: FlagType,
  status: FlagStatus,
  reason: string,
): RedFlag {
  const key =
    flagType === "MANAGEMENT"
      ? "management"
      : flagType === "SURVIVAL"
        ? "survival"
        : "tenx";
  const { penalty, hardStop } = flagPenalty(key, status);
  return { flagType, status, reason, penalty, hardStop };
}

export function defaultFlags(): RedFlag[] {
  return [
    makeFlag("MANAGEMENT", "GREEN", "거버넌스 적신호 없음 (확인된 범위)."),
    makeFlag("SURVIVAL", "GREEN", "단기 생존 위험 없음 (확인된 범위)."),
    makeFlag("TENX", "GREEN", "10x 구조가 극단적 동시 성공에만 의존하지 않음."),
  ];
}
