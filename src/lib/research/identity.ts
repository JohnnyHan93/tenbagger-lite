import { SAMPLE_RESEARCH_100 } from "../sample-research-100.ts";
import type { IndustryGroup } from "../engines/industry.ts";
import type { Company } from "../types.ts";

export type AdapterName =
  | "Software"
  | "Semiconductor"
  | "Healthcare"
  | "Financial"
  | "REIT"
  | "Biotech"
  | "Industrial"
  | "Telecom"
  | "Cybersecurity"
  | "Other";

export interface IdentityHint {
  ticker: string;
  aliases: string[];
  companyName: string;
  country: "US" | "KR";
  exchange: string;
  sector: string;
  industry: string;
  adapter: AdapterName;
  group: IndustryGroup;
}

/** Smoke 12 identity map — not part of the 100-name universe seed. */
export const SMOKE_12: IdentityHint[] = [
  {
    ticker: "MSFT",
    aliases: ["MSFT"],
    companyName: "Microsoft",
    country: "US",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Computer Software",
    adapter: "Software",
    group: "saas",
  },
  {
    ticker: "NVDA",
    aliases: ["NVDA"],
    companyName: "NVIDIA",
    country: "US",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Semiconductors",
    adapter: "Semiconductor",
    group: "semi",
  },
  {
    ticker: "INOD",
    aliases: ["INOD"],
    companyName: "Innodata",
    country: "US",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "EDP Services",
    adapter: "Software",
    group: "saas",
  },
  {
    ticker: "ASTS",
    aliases: ["ASTS"],
    companyName: "AST SpaceMobile",
    country: "US",
    exchange: "NASDAQ",
    sector: "Communications",
    industry: "Telecom Satellite",
    adapter: "Telecom",
    group: "other",
  },
  {
    ticker: "UNH",
    aliases: ["UNH"],
    companyName: "UnitedHealth Group",
    country: "US",
    exchange: "NYSE",
    sector: "Health Care",
    industry: "Managed Health Care",
    adapter: "Healthcare",
    group: "healthcare",
  },
  {
    ticker: "JPM",
    aliases: ["JPM"],
    companyName: "JPMorgan Chase",
    country: "US",
    exchange: "NYSE",
    sector: "Financials",
    industry: "Banks",
    adapter: "Financial",
    group: "financial",
  },
  {
    ticker: "PLD",
    aliases: ["PLD"],
    companyName: "Prologis",
    country: "US",
    exchange: "NYSE",
    sector: "Real Estate",
    industry: "REIT Industrial",
    adapter: "REIT",
    group: "reit",
  },
  {
    ticker: "005930.KS",
    aliases: ["005930", "005930.KS"],
    companyName: "삼성전자",
    country: "KR",
    exchange: "KRX",
    sector: "Information Technology",
    industry: "Semiconductors",
    adapter: "Semiconductor",
    group: "semi",
  },
  {
    ticker: "267260.KS",
    aliases: ["267260", "267260.KS"],
    companyName: "HD현대일렉트릭",
    country: "KR",
    exchange: "KRX",
    sector: "Industrials",
    industry: "Electrical Equipment",
    adapter: "Industrial",
    group: "industrial",
  },
  {
    ticker: "196170.KQ",
    aliases: ["196170", "196170.KS", "196170.KQ"],
    companyName: "알테오젠",
    country: "KR",
    exchange: "KOSDAQ",
    sector: "Health Care",
    industry: "Biotechnology",
    adapter: "Biotech",
    group: "pharma",
  },
  {
    ticker: "105560.KS",
    aliases: ["105560", "105560.KS"],
    companyName: "KB금융",
    country: "KR",
    exchange: "KRX",
    sector: "Financials",
    industry: "Banks",
    adapter: "Financial",
    group: "financial",
  },
  {
    ticker: "356680.KQ",
    aliases: ["356680", "356680.KS", "356680.KQ"],
    companyName: "엑스게이트",
    country: "KR",
    exchange: "KOSDAQ",
    sector: "Information Technology",
    industry: "Cybersecurity",
    adapter: "Cybersecurity",
    group: "saas",
  },
];

export const SMOKE_12_TICKERS = SMOKE_12.map((s) => s.ticker);

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function aliasSet(hint: IdentityHint): Set<string> {
  return new Set(hint.aliases.map(normalizeTicker).concat(normalizeTicker(hint.ticker)));
}

export function lookupIdentity(ticker: string): IdentityHint | null {
  const t = normalizeTicker(ticker);
  const smoke = SMOKE_12.find((s) => aliasSet(s).has(t));
  if (smoke) return smoke;
  const fromUniverse = SAMPLE_RESEARCH_100.find(
    (c) => normalizeTicker(c.ticker) === t || normalizeTicker(c.ticker).startsWith(t + "."),
  );
  if (!fromUniverse) {
    const six = t.replace(/\.(KS|KQ)$/i, "");
    const byCode = SAMPLE_RESEARCH_100.find((c) => normalizeTicker(c.ticker).startsWith(six));
    if (byCode) return companyToHint(byCode);
    return null;
  }
  return companyToHint(fromUniverse);
}

function companyToHint(c: Company): IdentityHint {
  return {
    ticker: c.ticker,
    aliases: [c.ticker, c.ticker.replace(/\.(KS|KQ)$/i, "")],
    companyName: c.companyName,
    country: c.country === "KR" ? "KR" : "US",
    exchange: c.exchange,
    sector: c.sector,
    industry: c.industry,
    adapter: adapterFromText(c.sector, c.industry),
    group: groupFromText(c.sector, c.industry),
  };
}

export function adapterFromText(sector: string, industry: string): AdapterName {
  const blob = `${sector} ${industry}`.toLowerCase();
  if (/reit|real estate investment/.test(blob)) return "REIT";
  if (/bank|insurance|capital market|asset manag|broker|financial/.test(blob)) return "Financial";
  if (/biotech|pharma|drug|therapeu/.test(blob)) return "Biotech";
  if (/health|hospital|medtech|medical|managed care/.test(blob)) return "Healthcare";
  if (/semiconductor|foundry|chip|fab|eda/.test(blob)) return "Semiconductor";
  if (/cyber/.test(blob)) return "Cybersecurity";
  if (/software|saas|edp|cloud|information technology/.test(blob)) return "Software";
  if (/telecom|satellite|space mobile/.test(blob)) return "Telecom";
  if (/industrial|machinery|electrical equipment|manufactur/.test(blob)) return "Industrial";
  return "Other";
}

export function groupFromText(sector: string, industry: string): IndustryGroup {
  const blob = `${sector} ${industry}`.toLowerCase();
  if (/reit|real estate investment/.test(blob)) return "reit";
  if (/bank|insurance|capital market|asset manag|broker|financial/.test(blob)) return "financial";
  if (/biotech|pharma|drug|therapeu/.test(blob)) return "pharma";
  if (/health|hospital|medtech|medical|managed care/.test(blob)) return "healthcare";
  if (/semiconductor|foundry|chip|fab|eda/.test(blob)) return "semi";
  if (/software|saas|edp|cloud|cyber|information technology/.test(blob)) return "saas";
  if (/consumer|retail|restaurant|apparel|food/.test(blob)) return "consumer";
  if (/industrial|machinery|electrical equipment|manufactur|aerospace/.test(blob)) return "industrial";
  return "other";
}

export function overlayIdentity<T extends {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  country: string;
  exchange: string;
}>(quote: T): T & { adapter?: AdapterName; group?: IndustryGroup } {
  const ident = lookupIdentity(quote.ticker);
  if (!ident) return quote;
  return {
    ...quote,
    companyName:
      quote.companyName && quote.companyName !== quote.ticker ? quote.companyName : ident.companyName,
    sector: quote.sector || ident.sector,
    industry: quote.industry || ident.industry,
    country: quote.country || ident.country,
    exchange: quote.exchange || ident.exchange,
    adapter: ident.adapter,
    group: ident.group,
  };
}
