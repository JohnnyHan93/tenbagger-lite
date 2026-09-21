import { cashRunwayYears, type DerivedMetrics } from "../metrics/derived.ts";
import type { XBaggerResult } from "./xbagger.ts";

/** Overlay only. Does not change XBG-v2.3 weights or F1–F10 scores. */
export const XBG_SCR_VERSION = "XBG-SCR-v1.0";

export type ScreenLevel = "OK" | "WATCH" | "FAIL" | "NA";
export type ScreenKind = "RUNWAY" | "DILUTION" | "POC" | "BACKLOG" | "BURN";

export interface ScreenFlag {
  kind: ScreenKind;
  level: ScreenLevel;
  label: string;
  reason: string;
}

export function xbaggerScreen(input: {
  xbagger: Pick<XBaggerResult, "gates">;
  derived: Pick<
    DerivedMetrics,
    "cash" | "fcf" | "opTtm" | "shareGrowth" | "backlogGrowth" | "runwayYears" | "industryGroup"
  >;
}): ScreenFlag[] {
  const d = input.derived;
  const flags: ScreenFlag[] = [];
  const rw = d.runwayYears ?? cashRunwayYears(d.cash, d.fcf, d.opTtm);

  if (rw != null && rw < 1) {
    flags.push({
      kind: "RUNWAY",
      level: "FAIL",
      label: "런웨이<1y",
      reason: `현금 런웨이 ${rw.toFixed(1)}년. 반복 증자 위험.`,
    });
  } else if (rw != null && rw < 2) {
    flags.push({
      kind: "RUNWAY",
      level: "WATCH",
      label: "런웨이<2y",
      reason: `현금 런웨이 ${rw.toFixed(1)}년.`,
    });
  }

  if (d.fcf != null && d.fcf < 0) {
    flags.push({
      kind: "BURN",
      level: rw != null && rw < 1 ? "FAIL" : "WATCH",
      label: "FCF적자",
      reason: "FCF 적자. 점수에 가산하지 않음.",
    });
  }

  if (d.shareGrowth != null && d.shareGrowth > 0.15) {
    flags.push({
      kind: "DILUTION",
      level: "FAIL",
      label: "희석",
      reason: `주식수 +${(d.shareGrowth * 100).toFixed(0)}%.`,
    });
  } else if (d.shareGrowth != null && d.shareGrowth > 0.08) {
    flags.push({
      kind: "DILUTION",
      level: "WATCH",
      label: "희석주의",
      reason: `주식수 +${(d.shareGrowth * 100).toFixed(0)}%.`,
    });
  }

  const cust = input.xbagger.gates.customer;
  if (cust === "WATCHLIST" || cust === "RESEARCH REQUIRED") {
    flags.push({
      kind: "POC",
      level: "WATCH",
      label: "PoC/고객미확인",
      reason: "이름 있는 유료 고객 없음. 데모만으로 점수를 올리지 않음.",
    });
  }

  if ((d.industryGroup === "semi" || d.industryGroup === "industrial") && d.backlogGrowth == null) {
    flags.push({
      kind: "BACKLOG",
      level: "NA",
      label: "백로그N/A",
      reason: "수주잔고→매출 전환 공시 없음. 지어내지 않음.",
    });
  }

  return flags;
}

export function formatScreenFlags(flags: ScreenFlag[]): string {
  const shown = flags.filter((f) => f.level === "FAIL" || f.level === "WATCH");
  if (!shown.length) return "—";
  return shown.map((f) => f.label).join(" · ");
}
