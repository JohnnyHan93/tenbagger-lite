import type { ResearchQuote } from "../types";
import {
  currencyOf,
  emptyFinancials,
  extractYahooQuoteFromHtml,
  parseCommaNumber,
  parseKoreanMoney,
  quoteFromYahooResult,
  type YahooResult,
} from "./quote-parse";

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        exchangeName?: string;
        currency?: string;
        regularMarketPrice?: number;
        longName?: string;
        shortName?: string;
      };
    }>;
  };
};

type YahooSummary = {
  quoteSummary?: {
    result?: YahooResult[];
  };
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function usableQuote(q: ResearchQuote | null): q is ResearchQuote {
  return !!(q && q.price > 0 && q.marketCap > 0);
}

async function fetchJson(url: string, timeout = 12000): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json,text/plain,*/*",
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json();
}

export function candidatesFor(raw: string): string[] {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return [];
  const out = [t];
  if (/^\d{6}$/.test(t)) {
    out.push(`${t}.KS`, `${t}.KQ`);
  }
  return [...new Set(out)];
}

function krCode(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})(?:\.(KS|KQ))?$/i);
  return m ? m[1]! : null;
}

async function tryYahooQuoteSummary(
  ticker: string,
): Promise<ResearchQuote | null> {
  try {
    const summary = (await fetchJson(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price,summaryProfile,defaultKeyStatistics,financialData`,
    )) as YahooSummary;
    const r = summary.quoteSummary?.result?.[0];
    if (!r) return null;
    return quoteFromYahooResult(ticker, r);
  } catch {
    return null;
  }
}

async function tryYahooQuotePage(ticker: string): Promise<ResearchQuote | null> {
  try {
    const res = await fetch(
      `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(18000),
      },
    );
    if (!res.ok) return null;
    const html = await res.text();
    return extractYahooQuoteFromHtml(html, ticker);
  } catch {
    // Node's default header limit rejects Yahoo's cookie jar.
    return null;
  }
}

async function tryYahooChart(ticker: string): Promise<ResearchQuote | null> {
  try {
    const chart = (await fetchJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
    )) as YahooChart;
    const meta = chart.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (price == null) return null;
    return {
      ticker,
      exchange: meta?.exchangeName ?? "",
      companyName: meta?.longName || meta?.shortName || ticker,
      currency: currencyOf(meta?.currency),
      price,
      marketCap: 0,
      enterpriseValue: 0,
      country: ticker.endsWith(".KS") || ticker.endsWith(".KQ") ? "KR" : "US",
      sector: "",
      industry: "",
      financials: emptyFinancials(),
    };
  } catch {
    return null;
  }
}

type NasdaqInfo = {
  data?: {
    companyName?: string;
    exchange?: string;
    primaryData?: { lastSalePrice?: string };
    secondaryData?: { lastSalePrice?: string };
  };
};

type NasdaqSummary = {
  data?: {
    summaryData?: {
      MarketCap?: { value?: string };
      Sector?: { value?: string };
      Industry?: { value?: string };
      Exchange?: { value?: string };
    };
  };
};

async function tryNasdaq(ticker: string): Promise<ResearchQuote | null> {
  if (ticker.includes(".")) return null;
  try {
    const [info, summary] = await Promise.all([
      fetchJson(
        `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/info?assetclass=stocks`,
      ) as Promise<NasdaqInfo>,
      fetchJson(
        `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/summary?assetclass=stocks`,
      ) as Promise<NasdaqSummary>,
    ]);
    const mcap = parseCommaNumber(
      summary.data?.summaryData?.MarketCap?.value ?? "",
    );
    const price =
      parseCommaNumber(info.data?.primaryData?.lastSalePrice ?? "") ??
      parseCommaNumber(info.data?.secondaryData?.lastSalePrice ?? "");
    if (!mcap || price == null) return null;
    return {
      ticker,
      exchange:
        info.data?.exchange || summary.data?.summaryData?.Exchange?.value || "",
      companyName: info.data?.companyName || ticker,
      currency: "USD",
      price,
      marketCap: mcap,
      enterpriseValue: mcap,
      country: "US",
      sector: summary.data?.summaryData?.Sector?.value ?? "",
      industry: summary.data?.summaryData?.Industry?.value ?? "",
      financials: emptyFinancials(),
    };
  } catch {
    return null;
  }
}

type NaverBasic = {
  stockName?: string;
  closePrice?: string;
  stockExchangeName?: string;
};

type NaverIntegration = {
  totalInfos?: Array<{ code?: string; key?: string; value?: string }>;
};

async function tryNaver(ticker: string): Promise<ResearchQuote | null> {
  const code = krCode(ticker);
  if (!code) return null;
  try {
    const [basic, integ] = await Promise.all([
      fetchJson(
        `https://m.stock.naver.com/api/stock/${code}/basic`,
      ) as Promise<NaverBasic>,
      fetchJson(
        `https://m.stock.naver.com/api/stock/${code}/integration`,
      ) as Promise<NaverIntegration>,
    ]);
    const price = parseCommaNumber(basic.closePrice ?? "");
    const mcapRow = integ.totalInfos?.find((r) => r.code === "marketValue");
    const mcap = parseKoreanMoney(mcapRow?.value ?? "");
    if (!price || !mcap) return null;
    const kosdaq = (basic.stockExchangeName ?? "").toUpperCase().includes("KOSDAQ");
    return {
      ticker: kosdaq ? `${code}.KQ` : `${code}.KS`,
      exchange: basic.stockExchangeName || (kosdaq ? "KOSDAQ" : "KSE"),
      companyName: basic.stockName || ticker,
      currency: "KRW",
      price,
      marketCap: mcap,
      enterpriseValue: mcap,
      country: "KR",
      sector: "",
      industry: "",
      financials: emptyFinancials(),
    };
  } catch {
    return null;
  }
}

function mergeQuotes(parts: Array<ResearchQuote | null>): ResearchQuote | null {
  const list = parts.filter((q): q is ResearchQuote => q != null);
  if (list.length === 0) return null;
  const base = list[0]!;
  const withMcap = list.find((q) => q.marketCap > 0);
  const withName = list.find((q) => q.companyName && q.companyName !== q.ticker);
  const withFin = list.find((q) => q.financials.revenueTtm != null);
  const withSector = list.find((q) => q.sector);
  return {
    ...base,
    companyName: withName?.companyName ?? base.companyName,
    exchange: withName?.exchange || base.exchange,
    marketCap: withMcap?.marketCap ?? base.marketCap,
    enterpriseValue:
      withMcap?.enterpriseValue || withMcap?.marketCap || base.enterpriseValue,
    sector: withSector?.sector || base.sector,
    industry: withSector?.industry || base.industry,
    financials: withFin?.financials ?? base.financials,
    country: withSector?.country || base.country,
  };
}

export async function resolveQuote(
  ticker: string,
): Promise<ResearchQuote | null> {
  const api = await tryYahooQuoteSummary(ticker);
  if (usableQuote(api)) return api;

  const page = await tryYahooQuotePage(ticker);
  if (usableQuote(page)) return page;

  const nasdaq = await tryNasdaq(ticker);
  if (usableQuote(nasdaq)) return nasdaq;

  const naver = await tryNaver(ticker);
  if (usableQuote(naver)) return naver;

  const chart = await tryYahooChart(ticker);
  return mergeQuotes([page, api, nasdaq, naver, chart]);
}
