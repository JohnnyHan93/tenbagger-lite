import type { Snapshot } from "../domain/snapshot.ts";
import type { OversoldResult } from "./oversold.ts";
import type { IndustryGroup } from "./industry.ts";

/** Overlay only. Does not change OSM Opp weights 40/25/10/25. */
export const OSM_MON_VERSION = "OSM-MON-v1.0";

export type PricePath = "GOOD_OVERSOLD" | "TRAP_RISK" | "RERATING" | "PRICE_RALLY";

export type OversoldAlertKind =
  | "OPP"
  | "RANK"
  | "VT"
  | "PRICE"
  | "PATH"
  | "ENTER"
  | "EXIT"
  | "DRAWDOWN";

export interface MegResult {
  meg: number | null;
  reason: string;
}

export interface PricePathResult {
  path: PricePath | null;
  label: string;
  reason: string;
}

export interface OversoldAlert {
  kind: OversoldAlertKind;
  message: string;
}

export const PRICE_PATH_LABEL: Record<PricePath, string> = {
  GOOD_OVERSOLD: "좋은 과매도",
  TRAP_RISK: "트랩 위험",
  RERATING: "재평가",
  PRICE_RALLY: "가격만 반등",
};

/**
 * Market Expectation Gap −2…+2. Never added to Opp.
 * Uses only scored F / O / Value Trap. Missing F or O → N/A.
 */
export function marketExpectationGap(o: Pick<OversoldResult, "fundamental" | "oversold" | "valueTrap">): MegResult {
  const f = o.fundamental;
  const os = o.oversold;
  const vt = o.valueTrap;
  if (f == null || os == null) {
    return { meg: null, reason: "F 또는 O 없음. MEG=N/A." };
  }
  if (f < 4 && vt >= 7) {
    return { meg: -2, reason: "펀더멘털 훼손 + Value Trap. 가격보다 사업이 더 나쁘다." };
  }
  if (f < 4 && os >= 6) {
    return { meg: -1, reason: "낙폭은 큰데 F가 약함. 싼 것이 아니라 망가진 쪽에 가깝다." };
  }
  if (f >= 7 && os >= 7 && vt <= 2) {
    return { meg: 2, reason: "F 유지·강한 낙폭·낮은 트랩. 시장 비관이 과도할 수 있다." };
  }
  if (f >= 6 && os >= 6 && vt < 5) {
    return { meg: 1, reason: "펀더멘털이 낙폭보다 낫다. 비관이 다소 과도." };
  }
  if (f >= 6 && os <= 2) {
    return { meg: 0, reason: "고점 근처. 확인된 위험을 가격이 대체로 반영." };
  }
  return { meg: 0, reason: "가격과 펀더멘털이 크게 어긋나지 않음." };
}

/**
 * OSM-MON Case A–D as price-vs-fundamental path.
 * Does not overwrite engine `oversold.case` (F vs O intensity).
 */
export function pricePathOf(o: Pick<OversoldResult, "fundamental" | "oversold">): PricePathResult {
  const f = o.fundamental;
  const os = o.oversold;
  if (f == null || os == null) {
    return { path: null, label: "—", reason: "F 또는 O 없음. 경로 N/A." };
  }
  if (os >= 6 && f >= 6) {
    return {
      path: "GOOD_OVERSOLD",
      label: PRICE_PATH_LABEL.GOOD_OVERSOLD,
      reason: "가격↓ · F 유지. 좋은 과매도 후보.",
    };
  }
  if (os >= 6 && f < 6) {
    return {
      path: "TRAP_RISK",
      label: PRICE_PATH_LABEL.TRAP_RISK,
      reason: "가격↓ · F 훼손. 낙폭만으로 Opp를 올리지 않음.",
    };
  }
  if (os <= 2 && f >= 6) {
    return {
      path: "RERATING",
      label: PRICE_PATH_LABEL.RERATING,
      reason: "가격 고점 근처 · F 양호. 과매도 우선순위 하락.",
    };
  }
  return {
    path: "PRICE_RALLY",
    label: PRICE_PATH_LABEL.PRICE_RALLY,
    reason: "가격은 고점 근처 · F는 약함.",
  };
}

export function formatMeg(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n > 0) return `+${n}`;
  return String(n);
}

export type CapitalReturnCode = "LIMITED_POS" | "NEGATIVE" | "NEUTRAL" | "NA";

export interface CapitalReturnResult {
  code: CapitalReturnCode;
  label: string;
  reason: string;
}

/** Share-count only. Never claims buyback+cancel (STRONG) without disclosure. */
export function capitalReturnOf(shareGrowth: number | null | undefined): CapitalReturnResult {
  if (shareGrowth == null || !Number.isFinite(shareGrowth)) {
    return { code: "NA", label: "—", reason: "주식수 시계열 없음. 환원 규모를 지어내지 않음." };
  }
  if (shareGrowth < 0) {
    return {
      code: "LIMITED_POS",
      label: "제한적 긍정",
      reason: "주식수 감소. 소각 여부는 공시 확인 전 강한 긍정으로 보지 않음.",
    };
  }
  if (shareGrowth > 0.1) {
    return { code: "NEGATIVE", label: "희석", reason: `주식수 +${(shareGrowth * 100).toFixed(0)}%.` };
  }
  return { code: "NEUTRAL", label: "중립", reason: "자사주 소각 공시 없음." };
}

export type SectorOverlayId = "BROKERAGE" | "AI_SOFTWARE" | "SEMI_HBM" | "NONE";

export interface SectorCheck {
  key: string;
  label: string;
  hint: string;
}

export interface SectorOverlayResult {
  id: SectorOverlayId;
  title: string;
  checks: SectorCheck[];
}

export function sectorOverlayOf(group: IndustryGroup): SectorOverlayResult {
  if (group === "financial") {
    return {
      id: "BROKERAGE",
      title: "증권/금융",
      checks: [
        { key: "adv", label: "일평균 거래대금", hint: "공시 확인. 제조업 P/E 강제 없음." },
        { key: "credit", label: "신용공여", hint: "공시 확인." },
        { key: "wmib", label: "WM / IB / 운용", hint: "공시 확인." },
        { key: "roe", label: "ROE", hint: "회계 ROIC로 대체하지 않음." },
        { key: "pf", label: "PF·조달", hint: "공시 확인." },
        { key: "return", label: "주주환원", hint: "자사주+소각 vs 보상용 취득." },
      ],
    };
  }
  if (group === "saas") {
    return {
      id: "AI_SOFTWARE",
      title: "AI / 소프트웨어",
      checks: [
        { key: "arr", label: "ARR / cRPO / NRR", hint: "주가가 아니라 실제 ARR·가이던스." },
        { key: "seats", label: "Seat / 가격", hint: "공시 확인." },
        { key: "ai", label: "AI 제품 매출", hint: "PoC만으로 올리지 않음." },
        { key: "retention", label: "유지율", hint: "공시 확인." },
      ],
    };
  }
  if (group === "semi") {
    return {
      id: "SEMI_HBM",
      title: "반도체 / HBM",
      checks: [
        { key: "hbm", label: "HBM 점유만 보지 않음", hint: "HBF/PIM/long-context도 확인." },
        { key: "asp", label: "ASP / Yield", hint: "초과마진 정상화는 F/R." },
        { key: "cust", label: "고객 인증", hint: "공시 확인." },
        { key: "om", label: "HBM 영업이익률", hint: "공시 확인." },
      ],
    };
  }
  return { id: "NONE", title: "", checks: [] };
}

export function oversoldAlerts(input: {
  prev: Snapshot | null | undefined;
  curr: Snapshot;
  prevRank: number | null;
  currRank: number | null;
}): OversoldAlert[] {
  const alerts: OversoldAlert[] = [];
  const curr = input.curr.oversold;
  const prev = input.prev?.oversold;
  if (prev && curr.opportunity != null && prev.opportunity != null) {
    const d = curr.opportunity - prev.opportunity;
    if (Math.abs(d) >= 0.2) {
      alerts.push({
        kind: "OPP",
        message: `Opp ${d > 0 ? "+" : ""}${d.toFixed(2)}`,
      });
    }
  }
  if (prev && Math.abs(curr.valueTrap - prev.valueTrap) >= 1) {
    const d = curr.valueTrap - prev.valueTrap;
    alerts.push({ kind: "VT", message: `Trap ${d > 0 ? "+" : ""}${d}` });
  }
  if (input.prev && input.prev.price > 0 && input.curr.price > 0) {
    const ch = input.curr.price / input.prev.price - 1;
    if (Math.abs(ch) >= 0.05) {
      alerts.push({
        kind: "PRICE",
        message: `가격 ${(ch * 100).toFixed(0)}%`,
      });
    }
  }
  const prevPath = prev ? pricePathOf(prev).path : null;
  const currPath = pricePathOf(curr).path;
  if (prevPath && currPath && prevPath !== currPath) {
    alerts.push({
      kind: "PATH",
      message: `${PRICE_PATH_LABEL[prevPath]} → ${PRICE_PATH_LABEL[currPath]}`,
    });
  }
  if (input.prevRank == null && input.currRank != null && input.currRank <= 10) {
    alerts.push({ kind: "ENTER", message: `Top 10 편입 #${input.currRank}` });
  }
  if (input.prevRank != null && input.currRank == null) {
    alerts.push({ kind: "EXIT", message: `Top 10 탈락 (이전 #${input.prevRank})` });
  }
  if (input.prevRank != null && input.currRank != null && Math.abs(input.currRank - input.prevRank) >= 2) {
    const d = input.prevRank - input.currRank;
    alerts.push({
      kind: "RANK",
      message: `순위 ${d > 0 ? "+" : ""}${d} (${input.prevRank}→${input.currRank})`,
    });
  }
  const prevDd = input.prev?.derived?.drawdown52w;
  const currDd = input.curr.derived?.drawdown52w;
  if (prevDd != null && currDd != null && Math.abs(currDd - prevDd) >= 0.1) {
    const d = currDd - prevDd;
    alerts.push({
      kind: "DRAWDOWN",
      message: `낙폭 ${d > 0 ? "+" : ""}${(d * 100).toFixed(0)}pp`,
    });
  }
  return alerts;
}
