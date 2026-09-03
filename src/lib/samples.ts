import { SCORING_VERSION } from "./scoring/config";
import { scoreAnalysis } from "./scoring/wildcard-score";
import { makeFlag } from "./risk/flags";
import type {
  Analysis,
  Company,
  Evidence,
  FactorScore,
  MasterHandoff,
} from "./types";
import type { FactorCode } from "./scoring/config";

function fs(
  code: FactorCode,
  score: number,
  summary: string,
): FactorScore {
  return {
    factorCode: code,
    score,
    evidenceSummary: summary,
    originalScore: score,
    overrideScore: null,
    overrideReason: null,
    overrideDate: null,
  };
}

function ev(
  id: string,
  code: FactorCode,
  text: string,
  type: Evidence["evidenceType"],
  source: string,
  url: string,
  date: string,
  confidence: number,
): Evidence {
  return {
    id,
    factorCode: code,
    evidence: text,
    evidenceType: type,
    sourceName: source,
    sourceUrl: url,
    sourceDate: date,
    confidence,
    createdAt: date,
  };
}

const C_RB: Company = {
  id: "c_277810",
  ticker: "277810.KQ",
  exchange: "KOSDAQ",
  companyName: "레인보우로보틱스",
  country: "KR",
  sector: "Industrials",
  industry: "Humanoid / Cobot Robotics",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

const C_ALAB: Company = {
  id: "c_alab",
  ticker: "ALAB",
  exchange: "NASDAQ",
  companyName: "Astera Labs",
  country: "US",
  sector: "Information Technology",
  industry: "AI Connectivity Semiconductors",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

const C_SMSN: Company = {
  id: "c_005930",
  ticker: "005930.KS",
  exchange: "KRX",
  companyName: "삼성전자",
  country: "KR",
  sector: "Information Technology",
  industry: "Memory / Foundry / Devices",
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

function finish(
  partial: Omit<
    Analysis,
    | "factorTotal"
    | "rawScore"
    | "adjustedScore"
    | "grade"
    | "verdict"
    | "hardStop"
  >,
): Analysis {
  const scored = scoreAnalysis(partial.factorScores, partial.redFlags);
  return { ...partial, ...scored };
}

const rbJuneScores = [
  fs("F1", 2, "휴머노이드·협동로봇 TAM이 구조적으로 확대 중."),
  fs("F2", 1, "매출은 성장하나 아직 절대 규모가 작음."),
  fs("F3", 1, "하드웨어 비중이 높아 매출 확대 시 생산·인력 동반."),
  fs("F4", 2, "KAIST 기원 제어 IP, 특허, 삼성 품질 기준."),
  fs("F5", 2, "국내 휴머노이드 선도, 삼성 계열 협력."),
  fs("F6", 1, "삼성 협력·초기 상용. 대량 Repeat PO는 제한적."),
  fs("F7", 2, "상장사, 삼성 백킹, 단기 생존 위험 낮음."),
  fs("F8", 2, "시총 약 8.4조. 10배는 글로벌 플랫폼화 수준."),
  fs("F9", 1, "제품 사이클은 있으나 양산 시점 불확실."),
  fs("F10", 1, "10배 ≈ 84조. 강한 성공이 필요하나 범위 안."),
];

const rbSeptScores = [
  fs("F1", 2, "휴머노이드 산업 CAPEX·응용처가 확대되는 초기 침투 구간."),
  fs("F2", 1, "성장 중이나 아직 초기. 절대 매출은 작음."),
  fs("F3", 1, "플랫폼 소프트웨어 잠재력은 있으나 생산 캐파 동반 필요."),
  fs("F4", 2, "고정밀 제어·액추에이터 IP, qualification barrier."),
  fs("F5", 2, "국내 휴머노이드 핵심 공급 후보, 삼성 협력 축."),
  fs("F6", 2, "삼성 휴머노이드 협력·평가가 양산 파이프라인으로 이동."),
  fs("F7", 2, "현금·상장 지위·전략 주주. 희석 위험 제한적."),
  fs("F8", 2, "시총 8.35조 대비 휴머노이드 TAM 포획 여지 큼."),
  fs("F9", 2, "삼성 휴머노이드, 신제품, 공장/양산 이벤트가 6–24개월 내."),
  fs("F10", 1, "10배 시총 ≈ 83.5조. 매출 수조 원 + 적정 멀티플로 설명 가능."),
];

export function buildSampleWorld(): {
  companies: Company[];
  analyses: Analysis[];
  handoffs: MasterHandoff[];
} {
  const aRbJune = finish({
    id: "a_277810_20260601",
    companyId: C_RB.id,
    analysisDate: "2026-06-01T00:00:00.000Z",
    price: 510000,
    marketCap: 9.9e12,
    enterpriseValue: 9.7e12,
    currency: "KRW",
    financials: {
      revenueTtm: 8.4e10,
      operatingIncomeTtm: -1.2e10,
      netIncomeTtm: -8e9,
      cash: 2.1e11,
      totalDebt: 1.5e10,
      sharesOutstanding: 19399858,
      grossMargin: 0.42,
      operatingMargin: -0.14,
      fcf: -2e10,
    },
    factorScores: rbJuneScores,
    tenxFeasibility: "POSSIBLE",
    redFlags: [
      makeFlag("MANAGEMENT", "GREEN", "전략 주주 삼성. 반복 희석·회계 이슈 없음."),
      makeFlag("SURVIVAL", "GREEN", "상장 현금 + 삼성 백킹. 24개월+ runway."),
      makeFlag("TENX", "YELLOW", "글로벌 휴머노이드 점유율과 마진이 동시에 열려야 10배."),
    ],
    tenxScenarios: [
      {
        scenario: "BASE",
        revenue: 1.2e12,
        operatingMargin: 0.12,
        netMargin: 0.08,
        netIncome: 9.6e10,
        multipleType: "EV_SALES",
        multipleValue: 18,
        impliedMarketCap: 2.16e13,
        upsideMultiple: 2.18,
      },
      {
        scenario: "BULL",
        revenue: 4.0e12,
        operatingMargin: 0.22,
        netMargin: 0.16,
        netIncome: 6.4e11,
        multipleType: "EV_SALES",
        multipleValue: 22,
        impliedMarketCap: 8.8e13,
        upsideMultiple: 8.89,
      },
    ],
    requiredRevenue: 4.6e12,
    requiredNetIncome: 3.3e12 / 25,
    requiredMarketShare: 0.08,
    requiredPe: 25,
    requiredEvSales: 18,
    oneSentenceThesis:
      "레인보우로보틱스는 구조적으로 성장하는 휴머노이드 시장에서 고정밀 제어 IP와 삼성 협력 축을 기반으로 양산 검증을 확대하고 있으며, 현재 약 9.9조 원에서 매출 수조 원과 플랫폼 멀티플을 달성하면 약 10배 기업가치가 수학적으로 가능하다.",
    thesisGate: "PASS",
    catalysts: ["삼성 휴머노이드 협력 진전", "신제품 라인업", "해외 채널"],
    risks: ["양산 지연", "경쟁 빅테크 내재화", "하드웨어 마진"],
    nextProof: ["대형 고객 Qualification", "Repeat PO", "Gross Margin 개선"],
    killCriteria: ["핵심 고객 양산 탈락", "매출 성장 장기간 둔화", "대규모 희석"],
    evidences: [
      ev("e_rb_j1", "F5", "삼성전자가 전략 투자·협력 축으로 기능.", "REPORTED", "Company IR", "https://rainbow-robotics.com", "2026-05-01", 0.8),
      ev("e_rb_j2", "F4", "KAIST 기원 이족보행·제어 스택, 다수 특허.", "FACT", "Company IR", "https://rainbow-robotics.com", "2026-04-01", 0.85),
    ],
    scoringVersion: SCORING_VERSION,
    researchProvider: "sample",
    createdAt: "2026-06-01T00:00:00.000Z",
  });

  const aRbSept = finish({
    id: "a_277810_20260903",
    companyId: C_RB.id,
    analysisDate: "2026-09-03T00:00:00.000Z",
    price: 430500,
    marketCap: 8.35e12,
    enterpriseValue: 8.15e12,
    currency: "KRW",
    financials: {
      revenueTtm: 9.6e10,
      operatingIncomeTtm: -9e9,
      netIncomeTtm: -5e9,
      cash: 1.9e11,
      totalDebt: 1.4e10,
      sharesOutstanding: 19399858,
      grossMargin: 0.44,
      operatingMargin: -0.09,
      fcf: -1.5e10,
    },
    factorScores: rbSeptScores,
    tenxFeasibility: "POSSIBLE",
    redFlags: [
      makeFlag("MANAGEMENT", "GREEN", "지배구조·희석 패턴에서 적신호 없음."),
      makeFlag("SURVIVAL", "GREEN", "현금 + 전략 주주. 생존이 thesis보다 먼저 깨질 가능성 낮음."),
      makeFlag("TENX", "GREEN", "시총 8.4조 기준 10배는 휴머노이드 플랫폼 성공으로 설명 가능. 모든 것이 완벽해야 겨우 10배는 아님."),
    ],
    tenxScenarios: [
      {
        scenario: "BASE",
        revenue: 1.5e12,
        operatingMargin: 0.14,
        netMargin: 0.1,
        netIncome: 1.5e11,
        multipleType: "EV_SALES",
        multipleValue: 16,
        impliedMarketCap: 2.4e13,
        upsideMultiple: 2.87,
      },
      {
        scenario: "BULL",
        revenue: 4.2e12,
        operatingMargin: 0.24,
        netMargin: 0.17,
        netIncome: 7.14e11,
        multipleType: "EV_SALES",
        multipleValue: 20,
        impliedMarketCap: 8.4e13,
        upsideMultiple: 10.06,
      },
    ],
    requiredRevenue: 4.2e12,
    requiredNetIncome: 3.34e11,
    requiredMarketShare: 0.07,
    requiredPe: 25,
    requiredEvSales: 20,
    oneSentenceThesis:
      "레인보우로보틱스는 구조적으로 성장하는 휴머노이드 시장에서 고정밀 제어 IP와 삼성 양산 협력 축을 기반으로 고객 검증을 확대하고 있으며, 현재 약 8.35조 원에서 매출 약 4.2조 원(EV/S 20배)을 달성하면 약 10배 기업가치가 수학적으로 가능하다.",
    thesisGate: "PASS",
    catalysts: [
      "삼성 휴머노이드 양산 일정",
      "신규 산업용 고객 PO",
      "해외 인증·판매 채널",
    ],
    risks: [
      "빅테크 휴머노이드 내재화",
      "양산 수율·원가",
      "테마 밸류에이션 수축",
    ],
    nextProof: [
      "삼성 라인 Qualification 완료",
      "Repeat PO 및 연간 수주 공개",
      "Gross Margin 흑자 전환",
    ],
    killCriteria: [
      "핵심 고객 Qualification 실패",
      "2년 연속 매출 성장 정체",
      "대규모 유상증자/CB로 thesis 희석",
    ],
    evidences: [
      ev("e_rb_s1", "F1", "글로벌 휴머노이드·협동로봇 투자 사이클이 CAPEX로 이어지는 초기 구간.", "INFERENCE", "Industry Data", "", "2026-08-01", 0.6),
      ev("e_rb_s2", "F5", "국내 상장 휴머노이드 순수플레이, 삼성 전략 협력.", "REPORTED", "Company IR", "https://rainbow-robotics.com", "2026-08-20", 0.85),
      ev("e_rb_s3", "F6", "삼성 휴머노이드 협력 파이프라인이 평가에서 양산 준비로 이동 중.", "REPORTED", "High Quality Media", "", "2026-08-15", 0.7),
      ev("e_rb_s4", "F7", "시총 8.35조, 발행주식 1,940만 주. 현금 여력과 전략 주주.", "FACT", "Exchange", "https://finance.naver.com/item/main.nhn?code=277810", "2026-09-03", 0.9),
      ev("e_rb_s5", "F10", "10배 시총 83.5조. Bull 매출 4.2조 × EV/S 20 = 84조.", "INFERENCE", "Tenbagger Lite 10x Engine", "", "2026-09-03", 0.7),
    ],
    scoringVersion: SCORING_VERSION,
    researchProvider: "sample",
    createdAt: "2026-09-03T00:00:00.000Z",
  });

  const alabScores = [
    fs("F1", 2, "AI 클러스터 연결(PCIe/CXL/이더넷)은 구조적 장기 성장."),
    fs("F2", 2, "2026 매출 고성장. Scorpio X 램프가 선행지표."),
    fs("F3", 2, "실리콘 IP, 높은 한계이익, 반복 설계 승."),
    fs("F4", 2, "Aries/Scorpio 자격 장벽, 성능 우위."),
    fs("F5", 2, "AI 랙 연결의 핵심 공급사."),
    fs("F6", 2, "하이퍼스케일러 양산·리피트 설계 승."),
    fs("F7", 2, "흑자, 현금, 희석 압력 낮음."),
    fs("F8", 0, "시총 약 $47.6B. 성공이 상당 부분 반영."),
    fs("F9", 1, "광학·커스텀 실리콘은 촉매이나 시점 불확실."),
    fs("F10", 1, "10배 = $476B. AI TAM 확대 + 멀티플 유지가 필요. 가능하나 강성공 가정."),
  ];

  const aAlab = finish({
    id: "a_alab_20260903",
    companyId: C_ALAB.id,
    analysisDate: "2026-09-03T00:00:00.000Z",
    price: 274.13,
    marketCap: 47.56e9,
    enterpriseValue: 46.8e9,
    currency: "USD",
    financials: {
      revenueTtm: 8.53e8,
      operatingIncomeTtm: 2.1e8,
      netIncomeTtm: 1.8e8,
      cash: 1.1e9,
      totalDebt: 0,
      sharesOutstanding: 173.5e6,
      grossMargin: 0.75,
      operatingMargin: 0.25,
      fcf: 1.5e8,
    },
    factorScores: alabScores,
    tenxFeasibility: "LOW",
    redFlags: [
      makeFlag("MANAGEMENT", "GREEN", "실행 기록 양호. 반복 희석·회계 이슈 없음."),
      makeFlag("SURVIVAL", "GREEN", "흑자·순현금. 생존 리스크 낮음."),
      makeFlag("TENX", "YELLOW", "$48B에서 10배는 연결 TAM의 대폭 확대와 높은 멀티플 유지가 동시에 필요."),
    ],
    tenxScenarios: [
      {
        scenario: "BASE",
        revenue: 6.0e9,
        operatingMargin: 0.32,
        netMargin: 0.24,
        netIncome: 1.44e9,
        multipleType: "EV_SALES",
        multipleValue: 18,
        impliedMarketCap: 1.08e11,
        upsideMultiple: 2.27,
      },
      {
        scenario: "BULL",
        revenue: 16e9,
        operatingMargin: 0.4,
        netMargin: 0.3,
        netIncome: 4.8e9,
        multipleType: "EV_SALES",
        multipleValue: 22,
        impliedMarketCap: 3.52e11,
        upsideMultiple: 7.4,
      },
    ],
    requiredRevenue: 26.4e9,
    requiredNetIncome: 19e9,
    requiredMarketShare: 0.25,
    requiredPe: 25,
    requiredEvSales: 18,
    oneSentenceThesis:
      "Astera Labs는 구조적으로 성장하는 AI 데이터센터 연결 시장에서 자격 장벽이 높은 리타이머/스위치 실리콘을 기반으로 하이퍼스케일러 양산을 확대하고 있으나, 현재 약 $47.6B에서 10배($476B)가 되려면 매출 약 $26B와 높은 멀티플이 동시에 필요해 추가 관찰이 맞다.",
    thesisGate: "PASS",
    catalysts: ["Scorpio X 램프", "광학 라인 기여", "커스텀 실리콘 2027 출하"],
    risks: ["멀티플 수축", "대형 고객 내재화", "경쟁 CRDO 등"],
    nextProof: ["광학 매출 기여 확인", "커스텀 실리콘 양산 PO", "성장률이 시총을 따라잡는지"],
    killCriteria: ["성장 급감", "핵심 고객 설계 탈락", "AI 캡엑스 사이클 종료 + 멀티플 붕괴"],
    evidences: [
      ev("e_alab_1", "F2", "시총 약 $47.6B, 주가 $274. 2026 매출 고성장 구간.", "FACT", "Yahoo Finance", "https://finance.yahoo.com/quote/ALAB/", "2026-09-03", 0.95),
      ev("e_alab_2", "F6", "하이퍼스케일러 AI 클러스터 연결 양산 공급.", "REPORTED", "Earnings Release", "", "2026-08-01", 0.8),
      ev("e_alab_3", "F8", "10배 시총 $476B는 초대형 반도체 플랫폼 영역. 현재 성공 상당 반영.", "INFERENCE", "Tenbagger Lite 10x Engine", "", "2026-09-03", 0.75),
    ],
    scoringVersion: SCORING_VERSION,
    researchProvider: "sample",
    createdAt: "2026-09-03T00:00:00.000Z",
  });

  const smsnScores = [
    fs("F1", 1, "메모리/파운드리는 성장하나 사이클. 구조적 초기 침투가 아님."),
    fs("F2", 1, "대형 베이스. 성장은 있으나 평범-사이클."),
    fs("F3", 1, "규모 경제는 있으나 막대한 캡엑스."),
    fs("F4", 1, "HBM·공정 리더십은 있으나 경쟁 치열 (SK, TSMC, 마이크론)."),
    fs("F5", 2, "글로벌 메모리 탑티어, 파운드리 의미 있는 위치."),
    fs("F6", 2, "전 세계 대형 고객, 장기 공급 계약."),
    fs("F7", 2, "순현금 기조의 초우량 재무."),
    fs("F8", 0, "시총 약 450조. 10배는 4,500조."),
    fs("F9", 1, "HBM·파운드리 점유 확대는 촉매이나 이미 알려진 스토리."),
    fs("F10", 0, "4,500조는 현실 매출·멀티플로 설명 불가."),
  ];

  const aSmsn = finish({
    id: "a_005930_20260903",
    companyId: C_SMSN.id,
    analysisDate: "2026-09-03T00:00:00.000Z",
    price: 74800,
    marketCap: 4.5e14,
    enterpriseValue: 4.2e14,
    currency: "KRW",
    financials: {
      revenueTtm: 3.1e14,
      operatingIncomeTtm: 3.5e13,
      netIncomeTtm: 2.8e13,
      cash: 9e13,
      totalDebt: 2e13,
      sharesOutstanding: 5.97e9,
      grossMargin: 0.37,
      operatingMargin: 0.11,
      fcf: 1.5e13,
    },
    factorScores: smsnScores,
    tenxFeasibility: "UNREALISTIC",
    redFlags: [
      makeFlag("MANAGEMENT", "GREEN", "글로벌 우량. 거버넌스 이슈가 10x 논점을 가리지 않음."),
      makeFlag("SURVIVAL", "GREEN", "순현금, 초우량. 생존 리스크 없음."),
      makeFlag("TENX", "RED", "산업 성장 + 점유 확대 + 마진 + 멀티플이 모두 완벽해도 시총 4,500조는 비현실. 10x 구조 RED."),
    ],
    tenxScenarios: [
      {
        scenario: "BASE",
        revenue: 4.5e14,
        operatingMargin: 0.16,
        netMargin: 0.12,
        netIncome: 5.4e13,
        multipleType: "PE",
        multipleValue: 14,
        impliedMarketCap: 7.56e14,
        upsideMultiple: 1.68,
      },
      {
        scenario: "BULL",
        revenue: 6.0e14,
        operatingMargin: 0.22,
        netMargin: 0.16,
        netIncome: 9.6e13,
        multipleType: "PE",
        multipleValue: 18,
        impliedMarketCap: 1.73e15,
        upsideMultiple: 3.84,
      },
    ],
    requiredRevenue: 3.2e15,
    requiredNetIncome: 2.25e14,
    requiredMarketShare: 0.8,
    requiredPe: 16,
    requiredEvSales: 10,
    oneSentenceThesis:
      "삼성전자는 메모리·파운드리 탑티어이나 현재 약 450조 원에서 10배(4,500조 원)가 되려면 비현실적 매출과 멀티플이 동시에 필요하다. 10x Math가 성립하지 않으므로 PASS.",
    thesisGate: "FAIL",
    catalysts: ["HBM 점유", "파운드리 대형 고객", "신규 노드"],
    risks: ["메모리 다운사이클", "파운드리 점유 정체", "캡엑스 부담"],
    nextProof: ["Wildcard 10x 후보가 아니므로 추적하지 않음"],
    killCriteria: ["이미 PASS. 시총이 구조적으로 작아지지 않는 한 재오픈하지 않음"],
    evidences: [
      ev("e_sm_1", "F10", "시총 약 450조. 10배 = 4,500조. Bull 시나리오도 약 3.8배에 그침.", "FACT", "Exchange", "https://finance.naver.com/item/main.nhn?code=005930", "2026-09-03", 0.95),
      ev("e_sm_2", "F5", "글로벌 메모리 탑티어, 파운드리 의미 있는 공급자.", "FACT", "Company IR", "https://www.samsung.com/sec/ir/", "2026-08-01", 0.9),
    ],
    scoringVersion: SCORING_VERSION,
    researchProvider: "sample",
    createdAt: "2026-09-03T00:00:00.000Z",
  });

  const handoffs: MasterHandoff[] = [
    {
      id: "h_277810",
      analysisId: aRbSept.id,
      companyId: C_RB.id,
      status: "NOT SENT",
      createdAt: aRbSept.createdAt,
      updatedAt: aRbSept.createdAt,
    },
  ];

  return {
    companies: [C_RB, C_ALAB, C_SMSN],
    analyses: [aRbJune, aRbSept, aAlab, aSmsn],
    handoffs,
  };
}
