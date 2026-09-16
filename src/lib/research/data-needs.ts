import type { Company } from "../types.ts";
import type { Snapshot } from "../domain/snapshot.ts";
import { FACTOR_META, type FactorCode } from "../scoring/config.ts";
import { fyCount, latestFy, pointsOf, seriesTrusted } from "../metrics/series.ts";
import { qualityImplStatus } from "../engines/quality.ts";

export type FillMode = "AUTO" | "MANUAL";
export type EngineId = "xbagger" | "oversold" | "quality";
export type FillKind = "money" | "pct" | "number" | "text" | "list" | "bool" | "fy3" | "q2";

export type FillFieldKey =
  | "revenueTtm"
  | "revenuePrior"
  | "operatingIncomeTtm"
  | "netIncomeTtm"
  | "cash"
  | "totalDebt"
  | "fcf"
  | "cfo"
  | "grossMargin"
  | "sharesOutstanding"
  | "high52w"
  | "pb"
  | "assets"
  | "capex"
  | "investedCapital"
  | "roic"
  | "interestCoverage"
  | "rdToRev"
  | "rdGrowth"
  | "backlogGrowth"
  | "bookToBill"
  | "customerConcentration"
  | "organicShare"
  | "goingConcern"
  | "tamCagr"
  | "marketShare"
  | "customers"
  | "moat"
  | "fyRevenue"
  | "fyOp"
  | "fyNi"
  | "fyCfo"
  | "fyFcf"
  | "fyPpe"
  | "fyCapex"
  | "fyIc"
  | "fyEps"
  | "fyDebt"
  | "fyShares"
  | "qRevenue";

export interface FillFieldDef {
  key: FillFieldKey;
  label: string;
  kind: FillKind;
  mode: FillMode;
  hint: string;
}

export interface DataNeedItem {
  engine: EngineId;
  factor: string;
  name: string;
  reason: string;
  mode: FillMode;
  fields: FillFieldKey[];
  kind: "Core" | "Conditional" | "Pillar" | "Factor";
}

export interface DataNeedReport {
  items: DataNeedItem[];
  fields: FillFieldDef[];
  counts: { x: number; o: number; q: number; auto: number; manual: number };
}

export const FILL_FIELDS: Record<FillFieldKey, FillFieldDef> = {
  revenueTtm: { key: "revenueTtm", label: "매출 (최근)", kind: "money", mode: "AUTO", hint: "TTM 또는 최근 연간" },
  revenuePrior: { key: "revenuePrior", label: "매출 (직전)", kind: "money", mode: "AUTO", hint: "직전 연간" },
  operatingIncomeTtm: { key: "operatingIncomeTtm", label: "영업이익", kind: "money", mode: "AUTO", hint: "" },
  netIncomeTtm: { key: "netIncomeTtm", label: "순이익", kind: "money", mode: "AUTO", hint: "" },
  cash: { key: "cash", label: "현금", kind: "money", mode: "AUTO", hint: "" },
  totalDebt: { key: "totalDebt", label: "총부채", kind: "money", mode: "AUTO", hint: "" },
  fcf: { key: "fcf", label: "FCF", kind: "money", mode: "AUTO", hint: "" },
  cfo: { key: "cfo", label: "CFO", kind: "money", mode: "AUTO", hint: "영업현금흐름" },
  grossMargin: { key: "grossMargin", label: "매출총이익률", kind: "pct", mode: "AUTO", hint: "40% 또는 0.4" },
  sharesOutstanding: { key: "sharesOutstanding", label: "발행주식수", kind: "number", mode: "AUTO", hint: "" },
  high52w: { key: "high52w", label: "52주 고점", kind: "number", mode: "AUTO", hint: "주가와 같은 단위" },
  pb: { key: "pb", label: "P/B", kind: "number", mode: "AUTO", hint: "금융·REIT" },
  assets: { key: "assets", label: "총자산", kind: "money", mode: "AUTO", hint: "" },
  capex: { key: "capex", label: "CAPEX (최근)", kind: "money", mode: "AUTO", hint: "절대값" },
  investedCapital: { key: "investedCapital", label: "Invested Capital", kind: "money", mode: "AUTO", hint: "" },
  roic: { key: "roic", label: "ROIC", kind: "pct", mode: "MANUAL", hint: "공시 ROIC" },
  interestCoverage: { key: "interestCoverage", label: "이자보상배수", kind: "number", mode: "MANUAL", hint: "EBIT / 이자" },
  rdToRev: { key: "rdToRev", label: "R&D / 매출", kind: "pct", mode: "MANUAL", hint: "" },
  rdGrowth: { key: "rdGrowth", label: "R&D 성장", kind: "pct", mode: "MANUAL", hint: "YoY" },
  backlogGrowth: { key: "backlogGrowth", label: "백로그 성장", kind: "pct", mode: "MANUAL", hint: "" },
  bookToBill: { key: "bookToBill", label: "Book-to-bill", kind: "number", mode: "MANUAL", hint: "1.2" },
  customerConcentration: { key: "customerConcentration", label: "고객 집중", kind: "pct", mode: "MANUAL", hint: "상위 고객 매출 비중" },
  organicShare: { key: "organicShare", label: "유기성장 비중", kind: "pct", mode: "MANUAL", hint: "M&A 제외" },
  goingConcern: { key: "goingConcern", label: "Going concern 공시", kind: "bool", mode: "MANUAL", hint: "감사보고서 문구" },
  tamCagr: { key: "tamCagr", label: "TAM CAGR", kind: "pct", mode: "MANUAL", hint: "외부 시장 성장률. 회사 매출 성장 아님" },
  marketShare: { key: "marketShare", label: "점유율", kind: "pct", mode: "MANUAL", hint: "숫자 있는 점유율만" },
  customers: { key: "customers", label: "고객명", kind: "list", mode: "MANUAL", hint: "쉼표로 구분. 매출만으로 대체하지 않음" },
  moat: { key: "moat", label: "해자·기술 근거", kind: "text", mode: "MANUAL", hint: "특허, 락인, 인증. 슬로건만은 안 됨" },
  fyRevenue: { key: "fyRevenue", label: "연간 매출 3년", kind: "fy3", mode: "AUTO", hint: "오래된 해 → 최근" },
  fyOp: { key: "fyOp", label: "연간 영업이익 3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyNi: { key: "fyNi", label: "연간 순이익 3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyCfo: { key: "fyCfo", label: "연간 CFO 3년", kind: "fy3", mode: "AUTO", hint: "지속성·성장" },
  fyFcf: { key: "fyFcf", label: "연간 FCF 3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyPpe: { key: "fyPpe", label: "연간 PPE 3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyCapex: { key: "fyCapex", label: "연간 CAPEX 3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyIc: { key: "fyIc", label: "연간 Invested Capital 3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyEps: { key: "fyEps", label: "연간 희석 EPS 2–3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyDebt: { key: "fyDebt", label: "연간 부채 2–3년", kind: "fy3", mode: "AUTO", hint: "" },
  fyShares: { key: "fyShares", label: "연간 희석주식수 3년", kind: "fy3", mode: "AUTO", hint: "" },
  qRevenue: { key: "qRevenue", label: "분기 매출 2개", kind: "q2", mode: "AUTO", hint: "직전 → 최근" },
};

const X_FIELDS: Partial<Record<FactorCode, FillFieldKey[]>> = {
  F1: ["tamCagr"],
  F2: ["revenueTtm", "revenuePrior", "fyRevenue"],
  F3: ["grossMargin", "operatingIncomeTtm"],
  F4: ["moat"],
  F5: ["marketShare"],
  F6: ["customers"],
  F7: ["cash", "totalDebt", "fcf", "cfo"],
  F8: ["revenueTtm"],
  F10: ["revenueTtm"],
};

const Q_FIELDS: Record<string, FillFieldKey[]> = {
  Q01: ["revenueTtm", "revenuePrior"],
  Q02: ["fyRevenue"],
  Q03: ["operatingIncomeTtm", "fyOp"],
  Q04: ["fyEps"],
  Q05: ["revenueTtm", "revenuePrior", "fyRevenue"],
  Q06: ["revenueTtm", "operatingIncomeTtm"],
  Q07: ["qRevenue"],
  Q08: ["organicShare"],
  Q09: ["grossMargin"],
  Q10: ["operatingIncomeTtm", "revenueTtm"],
  Q11: ["netIncomeTtm", "revenueTtm"],
  Q12: ["fyOp", "fyRevenue"],
  Q13: ["roic", "investedCapital"],
  Q14: ["roic"],
  Q16: ["revenueTtm", "operatingIncomeTtm"],
  Q17: ["cfo", "revenueTtm"],
  Q18: ["cfo", "netIncomeTtm"],
  Q19: ["fcf", "revenueTtm"],
  Q20: ["fyFcf"],
  Q21: ["fyCfo"],
  Q22: ["fyCfo"],
  Q24: ["fcf", "netIncomeTtm"],
  Q30: ["cash", "totalDebt"],
  Q31: ["interestCoverage"],
  Q35: ["fyDebt", "revenueTtm"],
  Q36: ["cash", "assets"],
  Q37: ["investedCapital", "revenueTtm"],
  Q38: ["fyIc", "fyOp"],
  Q39: ["assets", "revenueTtm"],
  Q40: ["fyPpe", "revenueTtm"],
  Q42: ["fyCapex", "revenueTtm"],
  Q43: ["capex", "revenueTtm"],
  Q44: ["capex", "cfo"],
  Q45: ["fyPpe"],
  Q46: ["rdToRev"],
  Q47: ["rdGrowth"],
  Q48: ["backlogGrowth"],
  Q50: ["bookToBill"],
  Q52: ["customerConcentration"],
  Q53: ["sharesOutstanding", "fyShares"],
  Q54: ["fyShares"],
  Q57: ["fcf"],
  Q70: ["goingConcern"],
};

function hasNum(n: number | null | undefined): boolean {
  return typeof n === "number" && Number.isFinite(n);
}

function seriesOk(snap: Snapshot, field: Parameters<typeof fyCount>[1], min: number): boolean {
  return fyCount(snap.derived.series ?? null, field) >= min;
}

function fieldMissing(snap: Snapshot, key: FillFieldKey): boolean {
  const f = snap.financials;
  const d = snap.derived;
  const s = d.series ?? null;
  switch (key) {
    case "revenueTtm":
      return !hasNum(f.revenueTtm);
    case "revenuePrior":
      return !hasNum(f.revenuePrior);
    case "operatingIncomeTtm":
      return !hasNum(f.operatingIncomeTtm);
    case "netIncomeTtm":
      return !hasNum(f.netIncomeTtm);
    case "cash":
      return !hasNum(f.cash);
    case "totalDebt":
      return !hasNum(f.totalDebt);
    case "fcf":
      return !hasNum(f.fcf);
    case "cfo":
      return !hasNum(f.cfo) && !hasNum(d.cfo);
    case "grossMargin":
      return !hasNum(f.grossMargin);
    case "sharesOutstanding":
      return !hasNum(f.sharesOutstanding);
    case "high52w":
      return !hasNum(d.high52w);
    case "pb":
      return !hasNum(d.pb);
    case "assets":
      return !hasNum(d.assets);
    case "capex":
      return !hasNum(d.capex);
    case "investedCapital":
      return !hasNum(d.investedCapital);
    case "roic":
      return !hasNum(d.roic);
    case "interestCoverage":
      return !hasNum(d.interestCoverage);
    case "rdToRev":
      return !hasNum(d.rdToRev);
    case "rdGrowth":
      return !hasNum(d.rdGrowth);
    case "backlogGrowth":
      return !hasNum(d.backlogGrowth);
    case "bookToBill":
      return !hasNum(d.bookToBill);
    case "customerConcentration":
      return !hasNum(d.customerConcentration);
    case "organicShare":
      return !hasNum(d.organicShare);
    case "goingConcern":
      return !d.goingConcernEvidence;
    case "tamCagr":
    case "marketShare":
    case "customers":
    case "moat":
      return true;
    case "fyRevenue":
      return !seriesOk(snap, "revenue", 4) && !seriesOk(snap, "revenue", 3);
    case "fyOp":
      return fyCount(s, "operatingIncome") < 2;
    case "fyNi":
      return fyCount(s, "netIncome") < 3;
    case "fyCfo":
      return fyCount(s, "cfo") < 3;
    case "fyFcf":
      return fyCount(s, "fcf") < 3;
    case "fyPpe":
      return latestFy(s, "ppe") == null;
    case "fyCapex":
      return latestFy(s, "capex") == null;
    case "fyIc":
      return fyCount(s, "investedCapital") < 2;
    case "fyEps":
      return fyCount(s, "epsDiluted") < 2;
    case "fyDebt":
      return fyCount(s, "debt") < 2;
    case "fyShares":
      return fyCount(s, "dilutedShares") < 3;
    case "qRevenue":
      return !seriesTrusted(s) || pointsOf(s, "Q").filter((p) => typeof p.revenue === "number").length < 2;
    default:
      return true;
  }
}

function modeOf(keys: FillFieldKey[], fallback: FillMode): FillMode {
  if (!keys.length) return fallback;
  return keys.every((k) => FILL_FIELDS[k].mode === "MANUAL") ? "MANUAL" : keys.some((k) => FILL_FIELDS[k].mode === "AUTO") && keys.every((k) => FILL_FIELDS[k].mode === "AUTO") ? "AUTO" : fallback;
}

export function listDataNeeds(snapshot: Snapshot, _company?: Company): DataNeedReport {
  const items: DataNeedItem[] = [];

  for (const f of snapshot.xbagger.factors) {
    if (f.score != null) continue;
    const code = f.code as FactorCode;
    const fields = (X_FIELDS[code] ?? []).filter((k) => fieldMissing(snapshot, k));
    const mapped = Boolean(X_FIELDS[code]);
    items.push({
      engine: "xbagger",
      factor: f.id,
      name: FACTOR_META[code]?.nameKo ?? f.name,
      reason: f.reason || "증거 없음",
      mode: mapped ? modeOf(fields, code === "F9" || code === "F4" ? "AUTO" : "MANUAL") : "MANUAL",
      fields,
      kind: "Factor",
    });
  }

  if (snapshot.oversold.fundamental == null) {
    const fields = (["revenueTtm", "operatingIncomeTtm", "fyRevenue"] as FillFieldKey[]).filter((k) => fieldMissing(snapshot, k));
    items.push({
      engine: "oversold",
      factor: "FUND",
      name: "펀더멘털",
      reason: snapshot.oversold.reasons.fundamental,
      mode: "AUTO",
      fields,
      kind: "Pillar",
    });
  }
  if (snapshot.oversold.valuation == null) {
    const fields = (["netIncomeTtm", "revenueTtm", "pb"] as FillFieldKey[]).filter((k) => fieldMissing(snapshot, k));
    items.push({
      engine: "oversold",
      factor: "VAL",
      name: "밸류에이션",
      reason: snapshot.oversold.reasons.valuation,
      mode: "AUTO",
      fields,
      kind: "Pillar",
    });
  }
  if (snapshot.oversold.oversold == null) {
    const fields = (["high52w"] as FillFieldKey[]).filter((k) => fieldMissing(snapshot, k));
    items.push({
      engine: "oversold",
      factor: "OS",
      name: "가격 낙폭",
      reason: snapshot.oversold.reasons.oversold,
      mode: "AUTO",
      fields,
      kind: "Pillar",
    });
  }
  if (snapshot.oversold.riskInverse == null) {
    const fields = (["cash", "totalDebt", "fcf", "fyShares"] as FillFieldKey[]).filter((k) => fieldMissing(snapshot, k));
    items.push({
      engine: "oversold",
      factor: "RISK",
      name: "리스크",
      reason: snapshot.oversold.reasons.risk,
      mode: "AUTO",
      fields,
      kind: "Pillar",
    });
  }

  for (const f of snapshot.quality.factors) {
    if (f.score != null) continue;
    if (f.applicability === "N" || f.applicability === "R") continue;
    if (f.kind === "Diagnostic" && f.id !== "Q70") continue;
    const fields = (Q_FIELDS[f.id] ?? []).filter((k) => fieldMissing(snapshot, k));
    const impl = qualityImplStatus(f.id, f.kind);
    items.push({
      engine: "quality",
      factor: f.id,
      name: f.name,
      reason: f.reason,
      mode: impl === "MANUAL_ONLY" || (fields.length && fields.every((k) => FILL_FIELDS[k].mode === "MANUAL")) ? "MANUAL" : "AUTO",
      fields,
      kind: f.kind === "Core" ? "Core" : "Conditional",
    });
  }

  const seen = new Set<FillFieldKey>();
  const fields: FillFieldDef[] = [];
  for (const item of items) {
    for (const k of item.fields) {
      if (seen.has(k)) continue;
      seen.add(k);
      fields.push(FILL_FIELDS[k]);
    }
  }

  const x = items.filter((i) => i.engine === "xbagger").length;
  const o = items.filter((i) => i.engine === "oversold").length;
  const q = items.filter((i) => i.engine === "quality").length;
  return {
    items,
    fields,
    counts: {
      x,
      o,
      q,
      auto: items.filter((i) => i.mode === "AUTO").length,
      manual: items.filter((i) => i.mode === "MANUAL").length,
    },
  };
}

export function engineGapCounts(snapshot: Snapshot) {
  return listDataNeeds(snapshot).counts;
}
