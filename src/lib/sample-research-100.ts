import { SAMPLE_RESEARCH_100_TAG } from "./demo.ts";
import type { Company } from "./types.ts";
import type { Universe } from "./domain/snapshot.ts";

const AS_OF = "2026-09-04T00:00:00.000Z";
export const SAMPLE_RESEARCH_100_UNIVERSE_ID = "u_sample_research_100";
export const SAMPLE_RESEARCH_100_NAME = "IDT SAMPLE RESEARCH 100";

type Row = [ticker: string, name: string, exchange: string, country: "US" | "KR", sector: string, industry: string, testProfile: string];

const US_SCREENER: Row[] = [
  ["INOD", "Innodata Inc.", "NASDAQ", "US", "Technology", "EDP Services", "US_SCREENER"],
  ["DSP", "Viant Technology Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["MNTN", "MNTN, Inc.", "NYSE", "US", "Consumer Discretionary", "Advertising", "US_SCREENER"],
  ["RDVT", "Red Violet, Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["BLZE", "Backblaze, Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["PGY", "Pagaya Technologies Ltd.", "NASDAQ", "US", "Technology", "Software Infrastructure", "US_SCREENER"],
  ["PDFS", "PDF Solutions, Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["QNST", "QuinStreet, Inc.", "NASDAQ", "US", "Consumer Discretionary", "Business Services", "US_SCREENER"],
  ["EVER", "EverQuote, Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["MAX", "MediaAlpha, Inc.", "NYSE", "US", "Consumer Discretionary", "Business Services", "US_SCREENER"],
  ["RSKD", "Riskified Ltd.", "NYSE", "US", "Consumer Discretionary", "Business Services", "US_SCREENER"],
  ["MITK", "Mitek Systems, Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["PAYS", "Paysign, Inc.", "NASDAQ", "US", "Technology", "EDP Services", "US_SCREENER"],
  ["BAND", "Bandwidth Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["WEAV", "Weave Communications, Inc.", "NYSE", "US", "Technology", "Application Software", "US_SCREENER"],
  ["ACVA", "ACV Auctions Inc.", "NYSE", "US", "Consumer Discretionary", "Business Services", "US_SCREENER"],
  ["ASTH", "Astrana Health Inc.", "NASDAQ", "US", "Health Care", "Professional Services", "US_SCREENER"],
  ["CEVA", "CEVA, Inc.", "NASDAQ", "US", "Technology", "Semiconductors", "US_SCREENER"],
  ["SMWB", "Similarweb Ltd.", "NYSE", "US", "Technology", "Application Software", "US_SCREENER"],
  ["ATEX", "Anterix Inc.", "NASDAQ", "US", "Telecommunications", "Telecom Equipment", "US_SCREENER"],
  ["PRLB", "Proto Labs, Inc.", "NYSE", "US", "Industrials", "Metal Fabrications", "US_SCREENER"],
  ["ETON", "Eton Pharmaceuticals, Inc.", "NASDAQ", "US", "Health Care", "Biotechnology", "US_SCREENER"],
  ["BLFS", "BioLife Solutions, Inc.", "NASDAQ", "US", "Health Care", "Biotechnology", "US_SCREENER"],
  ["ANAB", "AnaptysBio, Inc.", "NASDAQ", "US", "Health Care", "Biotechnology", "US_SCREENER"],
  ["XERS", "Xeris Biopharma Holdings, Inc.", "NASDAQ", "US", "Health Care", "Biotechnology", "US_SCREENER"],
  ["ALNT", "Allient Inc.", "NASDAQ", "US", "Industrials", "Electrical Products", "US_SCREENER"],
  ["MGTX", "MeiraGTx Holdings plc", "NASDAQ", "US", "Health Care", "Biotechnology", "US_SCREENER"],
  ["LQDT", "Liquidity Services, Inc.", "NASDAQ", "US", "Consumer Discretionary", "Business Services", "US_SCREENER"],
  ["BVS", "Bioventus Inc.", "NASDAQ", "US", "Health Care", "Medical Devices", "US_SCREENER"],
  ["APPS", "Digital Turbine, Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["PD", "PagerDuty, Inc.", "NYSE", "US", "Technology", "Application Software", "US_SCREENER"],
  ["NWPX", "NWPX Infrastructure, Inc.", "NASDAQ", "US", "Industrials", "Steel", "US_SCREENER"],
  ["RIGL", "Rigel Pharmaceuticals, Inc.", "NASDAQ", "US", "Health Care", "Biotechnology", "US_SCREENER"],
  ["NXDR", "Nextdoor Holdings, Inc.", "NYSE", "US", "Technology", "Application Software", "US_SCREENER"],
  ["VREX", "Varex Imaging Corporation", "NASDAQ", "US", "Technology", "Medical Equipment", "US_SCREENER"],
  ["MLAB", "Mesa Laboratories, Inc.", "NASDAQ", "US", "Industrials", "Industrial Instruments", "US_SCREENER"],
  ["ZVRA", "Zevra Therapeutics, Inc.", "NASDAQ", "US", "Health Care", "Biotechnology", "US_SCREENER"],
  ["SPT", "Sprout Social, Inc.", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["MTLS", "Materialise NV", "NASDAQ", "US", "Technology", "Application Software", "US_SCREENER"],
  ["ZIP", "ZipRecruiter, Inc.", "NYSE", "US", "Technology", "Application Software", "US_SCREENER"],
];

const US_THEME: Row[] = [
  ["IONQ", "IonQ, Inc.", "NYSE", "US", "Technology", "Quantum Computing", "US_THEME_QUANTUM"],
  ["RGTI", "Rigetti Computing, Inc.", "NASDAQ", "US", "Technology", "Quantum Computing", "US_THEME_QUANTUM"],
  ["QBTS", "D-Wave Quantum Inc.", "NYSE", "US", "Technology", "Quantum Computing", "US_THEME_QUANTUM"],
  ["APLD", "Applied Digital Corporation", "NASDAQ", "US", "Technology", "Data Center", "US_THEME_INFRA"],
  ["CRWV", "CoreWeave, Inc.", "NASDAQ", "US", "Technology", "Cloud Infrastructure", "US_THEME_INFRA"],
  ["RKLB", "Rocket Lab USA, Inc.", "NASDAQ", "US", "Industrials", "Aerospace", "US_THEME_AERO"],
  ["JOBY", "Joby Aviation, Inc.", "NYSE", "US", "Industrials", "Aerospace", "US_THEME_AERO"],
  ["SOUN", "SoundHound AI, Inc.", "NASDAQ", "US", "Technology", "Artificial Intelligence", "US_THEME_AI"],
  ["PATH", "UiPath, Inc.", "NYSE", "US", "Technology", "Application Software", "US_THEME_AI"],
  ["SNOW", "Snowflake Inc.", "NYSE", "US", "Technology", "Software Infrastructure", "US_THEME_INFRA"],
];

const KR_50: Row[] = [
  ["005930.KS", "삼성전자", "KRX", "KR", "Information Technology", "Semiconductors", "KR_MEGA"],
  ["000660.KS", "SK하이닉스", "KRX", "KR", "Information Technology", "Semiconductors", "KR_SEMI"],
  ["035420.KS", "NAVER", "KRX", "KR", "Communication Services", "Interactive Media", "KR_PLATFORM"],
  ["035720.KS", "카카오", "KRX", "KR", "Communication Services", "Interactive Media", "KR_PLATFORM"],
  ["051910.KS", "LG화학", "KRX", "KR", "Materials", "Chemicals", "KR_CHEM"],
  ["006400.KS", "삼성SDI", "KRX", "KR", "Industrials", "Electrical Equipment", "KR_BATTERY"],
  ["373220.KS", "LG에너지솔루션", "KRX", "KR", "Industrials", "Electrical Equipment", "KR_BATTERY"],
  ["207940.KS", "삼성바이오로직스", "KRX", "KR", "Health Care", "Biotechnology", "KR_BIO"],
  ["068270.KS", "셀트리온", "KRX", "KR", "Health Care", "Biotechnology", "KR_BIO"],
  ["005380.KS", "현대차", "KRX", "KR", "Consumer Discretionary", "Automobiles", "KR_AUTO"],
  ["000270.KS", "기아", "KRX", "KR", "Consumer Discretionary", "Automobiles", "KR_AUTO"],
  ["012330.KS", "현대모비스", "KRX", "KR", "Consumer Discretionary", "Auto Parts", "KR_AUTO"],
  ["005290.KS", "동진쎄미켐", "KRX", "KR", "Materials", "Specialty Chemicals", "KR_SEMI"],
  ["000990.KS", "DB하이텍", "KRX", "KR", "Information Technology", "Semiconductors", "KR_SEMI"],
  ["066570.KS", "LG전자", "KRX", "KR", "Consumer Discretionary", "Consumer Electronics", "KR_MEGA"],
  ["003670.KS", "포스코퓨처엠", "KRX", "KR", "Materials", "Chemicals", "KR_BATTERY"],
  ["009150.KS", "삼성전기", "KRX", "KR", "Information Technology", "Electronic Components", "KR_SEMI"],
  ["034730.KS", "SK", "KRX", "KR", "Industrials", "Conglomerates", "KR_MEGA"],
  ["096770.KS", "SK이노베이션", "KRX", "KR", "Energy", "Oil Gas Refining", "KR_ENERGY"],
  ["010130.KS", "고려아연", "KRX", "KR", "Materials", "Metals Mining", "KR_MATERIALS"],
  ["011200.KS", "HMM", "KRX", "KR", "Industrials", "Marine Shipping", "KR_SHIP"],
  ["015760.KS", "한국전력", "KRX", "KR", "Utilities", "Electric", "KR_UTIL"],
  ["055550.KS", "신한지주", "KRX", "KR", "Financials", "Banks", "KR_FIN"],
  ["105560.KS", "KB금융", "KRX", "KR", "Financials", "Banks", "KR_FIN"],
  ["086790.KS", "하나금융지주", "KRX", "KR", "Financials", "Banks", "KR_FIN"],
  ["032830.KS", "삼성생명", "KRX", "KR", "Financials", "Insurance", "KR_FIN"],
  ["000810.KS", "삼성화재", "KRX", "KR", "Financials", "Insurance", "KR_FIN"],
  ["003550.KS", "LG", "KRX", "KR", "Industrials", "Conglomerates", "KR_MEGA"],
  ["017670.KS", "SK텔레콤", "KRX", "KR", "Communication Services", "Telecom", "KR_TELCO"],
  ["030200.KS", "KT", "KRX", "KR", "Communication Services", "Telecom", "KR_TELCO"],
  ["018260.KS", "삼성에스디에스", "KRX", "KR", "Information Technology", "IT Services", "KR_IT"],
  ["036570.KS", "엔씨소프트", "KRX", "KR", "Communication Services", "Entertainment", "KR_GAME"],
  ["251270.KS", "넷마블", "KRX", "KR", "Communication Services", "Entertainment", "KR_GAME"],
  ["259960.KS", "크래프톤", "KRX", "KR", "Communication Services", "Entertainment", "KR_GAME"],
  ["352820.KS", "하이브", "KRX", "KR", "Communication Services", "Entertainment", "KR_MEDIA"],
  ["326030.KS", "SK바이오팜", "KRX", "KR", "Health Care", "Pharmaceuticals", "KR_BIO"],
  ["247540.KS", "에코프로비엠", "KRX", "KR", "Materials", "Chemicals", "KR_BATTERY"],
  ["086520.KS", "에코프로", "KRX", "KR", "Materials", "Chemicals", "KR_BATTERY"],
  ["003490.KS", "대한항공", "KRX", "KR", "Industrials", "Airlines", "KR_TRANSPORT"],
  ["009540.KS", "HD한국조선해양", "KRX", "KR", "Industrials", "Shipbuilding", "KR_SHIP"],
  ["267250.KS", "HD현대", "KRX", "KR", "Energy", "Oil Gas", "KR_ENERGY"],
  ["042700.KS", "한미반도체", "KRX", "KR", "Information Technology", "Semiconductor Equipment", "KR_SEMI"],
  ["058470.KS", "리노공업", "KRX", "KR", "Information Technology", "Semiconductor Equipment", "KR_SEMI"],
  ["039030.KS", "이오테크닉스", "KRX", "KR", "Information Technology", "Semiconductor Equipment", "KR_SEMI"],
  ["240810.KS", "원익IPS", "KRX", "KR", "Information Technology", "Semiconductor Equipment", "KR_SEMI"],
  ["064350.KS", "현대로템", "KRX", "KR", "Industrials", "Machinery", "KR_DEFENSE"],
  ["012450.KS", "한화에어로스페이스", "KRX", "KR", "Industrials", "Aerospace Defense", "KR_DEFENSE"],
  ["047810.KS", "한국항공우주", "KRX", "KR", "Industrials", "Aerospace Defense", "KR_DEFENSE"],
  ["028260.KS", "삼성물산", "KRX", "KR", "Industrials", "Conglomerates", "KR_MEGA"],
  ["010950.KS", "S-Oil", "KRX", "KR", "Energy", "Oil Gas Refining", "KR_ENERGY"],
];

const ROWS: Row[] = [...US_SCREENER, ...US_THEME, ...KR_50];

function identity(row: Row): Company {
  const [ticker, name, exchange, country, sector, industry, testProfile] = row;
  return {
    id: `c_${ticker}`,
    ticker,
    exchange,
    companyName: name,
    country,
    sector,
    industry,
    sample: false,
    seedTag: SAMPLE_RESEARCH_100_TAG,
    testProfile,
    createdAt: AS_OF,
    updatedAt: AS_OF,
  };
}

export const SAMPLE_RESEARCH_100: Company[] = ROWS.map(identity);

export function sampleResearch100Stats(companies: Company[] = SAMPLE_RESEARCH_100) {
  const us = companies.filter((c) => c.country === "US").length;
  const kr = companies.filter((c) => c.country === "KR").length;
  return { total: companies.length, us, kr };
}

export function sampleResearch100Universe(companies: Company[] = SAMPLE_RESEARCH_100): Universe {
  return {
    id: SAMPLE_RESEARCH_100_UNIVERSE_ID,
    name: SAMPLE_RESEARCH_100_NAME,
    version: 1,
    market: "GLOBAL",
    status: "open",
    createdAt: AS_OF,
    lockedAt: null,
    tickers: companies.map((c) => ({ ticker: c.ticker, name: c.companyName })),
  };
}
