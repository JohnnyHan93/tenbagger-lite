import type { DerivedMetrics } from "../metrics/derived.ts";
import type { OversoldResult } from "./oversold.ts";
import type { QualityResult } from "./quality.ts";
import type { XBaggerResult } from "./xbagger.ts";

export const LENS_VERSION = "LENS-v1.0";

export type LensVerdict = "PASS" | "WATCH" | "FAIL" | "N/A";

export interface LensResult {
  id: string;
  name: string;
  verdict: LensVerdict;
  coverage: number;
  strengths: string[];
  concerns: string[];
  questions: string[];
}

function v(pass: boolean, fail: boolean): LensVerdict {
  if (fail) return "FAIL";
  if (pass) return "PASS";
  return "WATCH";
}

export function scoreLenses(input: {
  m: DerivedMetrics;
  x: XBaggerResult;
  o: OversoldResult;
  q: QualityResult;
}): LensResult[] {
  const { m, x, o, q } = input;
  const gm = m.gm;
  const roic = m.roic;
  const fcf = m.fcf;
  const nd = m.netDebt;
  const growth = m.revenueYoY;
  const dd = m.drawdown52w;
  const qScore = q.score;

  return [
    {
      id: "buffett",
      name: "Buffett",
      verdict: v((roic != null && roic > 0.12 && (fcf ?? 0) > 0) || (qScore != null && qScore >= 70), (fcf != null && fcf < 0 && (nd ?? 0) > 0)),
      coverage: [roic, fcf, gm].filter((x) => x != null).length / 3,
      strengths: [gm != null && gm > 0.4 ? "두터운 마진" : "", (fcf ?? 0) > 0 ? "현금 창출력" : ""].filter(Boolean),
      concerns: [(fcf ?? 0) < 0 ? "FCF 적자" : ""].filter(Boolean),
      questions: ["해자가 10년 뒤에도 남는가?", "자본배분이 소유주 친화적인가?"],
    },
    {
      id: "munger",
      name: "Munger",
      verdict: v(q.redFlag === "GREEN" && (qScore ?? 0) >= 65, q.redFlag === "RED"),
      coverage: q.coverage,
      strengths: q.redFlag === "GREEN" ? ["회계 적신호 낮음"] : [],
      concerns: q.redFlag !== "GREEN" ? ["인센티브·회계 추가 확인"] : [],
      questions: ["이 사업이 망하는 경로를 거꾸로 적으면 무엇인가?"],
    },
    {
      id: "graham",
      name: "Graham",
      verdict: v((nd != null && nd < 0 && (o.valuation ?? 0) >= 7) || (o.opportunity ?? 0) >= 7, (nd ?? 0) > 0 && (m.netDebtEbitda ?? 0) > 4),
      coverage: [nd, o.valuation, m.pe].filter((x) => x != null).length / 3,
      strengths: [nd != null && nd < 0 ? "순현금" : ""].filter(Boolean),
      concerns: [(m.pe ?? 99) > 25 ? "안전마진 부족 가능" : ""].filter(Boolean),
      questions: ["청산·정규화 이익 대비 가격은?"],
    },
    {
      id: "fisher",
      name: "Fisher",
      verdict: v((growth ?? 0) > 0.12 && (m.rdToRev ?? 0) > 0.05, (growth ?? 1) < 0),
      coverage: [growth, m.rdToRev].filter((x) => x != null).length / 2,
      strengths: [(growth ?? 0) > 0.15 ? "성장 활주로" : ""].filter(Boolean),
      concerns: [],
      questions: ["제품 파이프라인과 영업조직이 성장을 뒷받침하는가?"],
    },
    {
      id: "lynch",
      name: "Lynch",
      verdict: v((growth ?? 0) > 0.15 && (m.evSales ?? 99) < 8, (m.evSales ?? 0) > 20),
      coverage: [growth, m.evSales].filter((x) => x != null).length / 2,
      strengths: ["스토리와 숫자 대조 필요"],
      concerns: [(m.evSales ?? 0) > 15 ? "성장 대비 비싸 보임" : ""].filter(Boolean),
      questions: ["PEG와 사업 단순성은?"],
    },
    {
      id: "templeton",
      name: "Templeton",
      verdict: v((dd ?? 0) > 0.35 && (o.fundamental ?? 0) >= 6, o.case === "C"),
      coverage: [dd, o.fundamental].filter((x) => x != null).length / 2,
      strengths: [(dd ?? 0) > 0.3 ? "비관이 가격에 반영" : ""].filter(Boolean),
      concerns: o.case === "C" ? ["펀더멘털 훼손과 낙폭이 겹침"] : [],
      questions: ["컨센서스가 너무 Crowded한가?"],
    },
    {
      id: "pabrai",
      name: "Pabrai",
      verdict: v((o.valueTrap <= 4 && (x.tenxFeasibility === "HIGH" || (o.opportunity ?? 0) >= 6)), o.valueTrap >= 7),
      coverage: 0.7,
      strengths: o.valueTrap <= 4 ? ["하방 제한 가능"] : [],
      concerns: o.valueTrap >= 7 ? ["Heads I lose 위험"] : [],
      questions: ["꼬리 손실이 원금의 얼마인가?"],
    },
    {
      id: "dalio",
      name: "Dalio",
      verdict: "N/A",
      coverage: 0,
      strengths: [],
      concerns: ["매크로 레짐은 개별 품질을 대체하지 않음"],
      questions: ["금리·달러·신용 사이클에 이 사업이 얼마나 민감한가?"],
    },
    {
      id: "soros",
      name: "Soros",
      verdict: v((o.opportunity ?? 0) >= 6 && x.status !== "RESEARCH REQUIRED", false),
      coverage: o.coverage,
      strengths: ["기대와 펀더멘털 갭을 추적"],
      concerns: ["내러티브 과열 여부 미확인"],
      questions: ["지금 가격에 어떤 이야기가 이미 들어 있는가?"],
    },
    {
      id: "simons",
      name: "Simons",
      verdict: q.coverage >= 0.7 && x.coverage >= 0.7 ? "WATCH" : "N/A",
      coverage: Math.min(q.coverage, x.coverage),
      strengths: ["데이터 품질이 신호의 전제"],
      concerns: q.coverage < 0.7 ? ["커버리지 부족 → 위양성 위험"] : [],
      questions: ["이 패턴의 베이스레이트는?"],
    },
  ];
}

export function guruConsensus(lenses: LensResult[]): string {
  const counted = lenses.filter((l) => l.verdict !== "N/A");
  if (!counted.length) return "N/A";
  const pass = counted.filter((l) => l.verdict === "PASS").length;
  const fail = counted.filter((l) => l.verdict === "FAIL").length;
  if (fail >= 3) return "FAIL-heavy";
  if (pass >= 4) return "PASS-leaning";
  return "MIXED";
}
