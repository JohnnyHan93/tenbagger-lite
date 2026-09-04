import type { ResearchQuote, SourceAttempt } from "../types";
import {
  currencyOf,
  emptyFinancials,
  extrasFromNaverAnnual,
  extrasFromWiseReport,
  extractYahooQuoteFromHtml,
  financialsFromNasdaq,
  financialsFromNaverAnnual,
  financialsFromWiseReport,
  parseCommaNumber,
  parseKoreanMoney,
  quoteFromYahooResult,
  type NasdaqFinancialsPayload,
  type NaverAnnualPayload,
  type YahooResult,
} from "./quote-parse";
import { overlayIdentity } from "./identity";

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
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
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
      high52w: meta?.fiftyTwoWeekHigh ?? null,
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
    const [info, summary, financialsRaw] = await Promise.all([
      fetchJson(
        `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/info?assetclass=stocks`,
      ) as Promise<NasdaqInfo>,
      fetchJson(
        `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/summary?assetclass=stocks`,
      ) as Promise<NasdaqSummary>,
      fetchJson(
        `https://api.nasdaq.com/api/company/${encodeURIComponent(ticker)}/financials?frequency=1`,
      ).catch(() => null) as Promise<NasdaqFinancialsPayload | null>,
    ]);
    const mcap = parseCommaNumber(
      summary.data?.summaryData?.MarketCap?.value ?? "",
    );
    const price =
      parseCommaNumber(info.data?.primaryData?.lastSalePrice ?? "") ??
      parseCommaNumber(info.data?.secondaryData?.lastSalePrice ?? "");
    if (!mcap || price == null) return null;
    const financials =
      (financialsRaw && financialsFromNasdaq(financialsRaw)) || emptyFinancials();
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
      financials,
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
    const highRow = integ.totalInfos?.find((r) => r.code === "highPriceOf52Weeks");
    const pbrRow = integ.totalInfos?.find((r) => r.code === "pbr");
    const high52w = parseCommaNumber(highRow?.value ?? "");
    const pb = parseCommaNumber((pbrRow?.value ?? "").replace(/배/g, ""));
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
      high52w,
      pb,
    };
  } catch {
    return null;
  }
}

async function tryNaverAnnual(ticker: string): Promise<{
  financials: ReturnType<typeof financialsFromNaverAnnual>;
  extras: ReturnType<typeof extrasFromNaverAnnual>;
} | null> {
  const code = krCode(ticker);
  if (!code) return null;
  try {
    const payload = (await fetchJson(
      `https://m.stock.naver.com/api/stock/${code}/finance/annual`,
    )) as NaverAnnualPayload;
    const financials = financialsFromNaverAnnual(payload);
    if (!financials) return null;
    return { financials, extras: extrasFromNaverAnnual(payload) };
  } catch {
    return null;
  }
}

function stampAttempt(
  provider: string,
  started: number,
  status: SourceAttempt["status"],
  notes?: string,
  errorType?: string,
): SourceAttempt {
  return {
    provider,
    requestedAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
    status,
    notes,
    errorType,
  };
}

async function tryWiseReport(ticker: string): Promise<{
  financials: ReturnType<typeof financialsFromWiseReport>;
  extras: ReturnType<typeof extrasFromWiseReport>;
} | null> {
  const code = krCode(ticker);
  if (!code) return null;
  try {
    const res = await fetch(
      `https://navercomp.wisereport.co.kr/v2/company/cF1001.aspx?cmp_cd=${code}&finGubun=MAIN`,
      {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return null;
    const html = await res.text();
    return {
      financials: financialsFromWiseReport(html),
      extras: extrasFromWiseReport(html),
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
  const with52 = list.find((q) => q.high52w != null);
  const withPb = list.find((q) => q.pb != null);
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
    country: withSector?.country || withMcap?.country || base.country,
    high52w: with52?.high52w ?? base.high52w ?? null,
    pb: withPb?.pb ?? base.pb ?? null,
    extras: { ...base.extras, ...withFin?.extras, ...with52?.extras },
  };
}

export async function resolveQuote(
  ticker: string,
): Promise<ResearchQuote | null> {
  const attempts: SourceAttempt[] = [];
  const api = await tryYahooQuoteSummary(ticker);
  attempts.push(
    stampAttempt("yahoo-quoteSummary", Date.now(), api ? "ok" : "empty", ticker),
  );
  let page: ResearchQuote | null = null;
  let nasdaq: ResearchQuote | null = null;
  if (!usableQuote(api) && !ticker.includes(".")) {
    nasdaq = await tryNasdaq(ticker);
    attempts.push(stampAttempt("nasdaq", Date.now(), nasdaq ? "ok" : "empty", ticker));
  }
  if (!usableQuote(api) && !usableQuote(nasdaq)) {
    page = await tryYahooQuotePage(ticker);
    attempts.push(stampAttempt("yahoo-html", Date.now(), page ? "ok" : "empty", ticker));
  }
  if (!usableQuote(api) && !usableQuote(nasdaq) && !usableQuote(page) && !ticker.includes(".")) {
    nasdaq = nasdaq ?? (await tryNasdaq(ticker));
  }
  const naver = await tryNaver(ticker);
  attempts.push(stampAttempt("naver-basic", Date.now(), naver ? "ok" : "empty", ticker));
  const chart = await tryYahooChart(ticker);
  attempts.push(stampAttempt("yahoo-chart", Date.now(), chart ? "ok" : "empty", ticker));
  let merged = mergeQuotes([api, nasdaq, page, naver, chart]);
  if (!merged) return null;

  if (krCode(merged.ticker)) {
    const annual = await tryNaverAnnual(merged.ticker);
    attempts.push(
      stampAttempt(
        "naver-annual",
        Date.now(),
        annual?.financials ? "ok" : "empty",
        annual?.financials ? `FY${annual.extras.fiscalYear ?? ""} 억원 annual` : "no annuals",
      ),
    );
    if (annual?.financials) {
      merged = {
        ...merged,
        financials: {
          ...merged.financials,
          ...annual.financials,
          cash: merged.financials.cash ?? annual.financials.cash,
          totalDebt: merged.financials.totalDebt ?? annual.financials.totalDebt,
        },
        pb: merged.pb ?? annual.extras.pb,
        extras: { ...merged.extras, ...annual.extras },
      };
    }
    const wr = await tryWiseReport(merged.ticker);
    attempts.push(
      stampAttempt(
        "wisereport",
        Date.now(),
        wr?.financials ? "ok" : "empty",
        wr?.extras.statementBasis ? `IFRS ${wr.extras.statementBasis}` : "no table",
      ),
    );
    if (wr) {
      const fin = merged.financials;
      const w = wr.financials;
      merged = {
        ...merged,
        financials: {
          ...fin,
          revenueTtm: fin.revenueTtm ?? w?.revenueTtm ?? null,
          revenuePrior: fin.revenuePrior ?? w?.revenuePrior ?? null,
          operatingIncomeTtm: fin.operatingIncomeTtm ?? w?.operatingIncomeTtm ?? null,
          netIncomeTtm: fin.netIncomeTtm ?? w?.netIncomeTtm ?? null,
          operatingMargin: fin.operatingMargin ?? w?.operatingMargin ?? null,
          cfo: fin.cfo ?? w?.cfo ?? wr.extras.cfo ?? null,
          fcf: fin.fcf ?? w?.fcf ?? null,
          fcfSource: fin.fcfSource ?? w?.fcfSource ?? null,
          cash: fin.cash ?? w?.cash ?? null,
          totalDebt: fin.totalDebt ?? w?.totalDebt ?? wr.extras.debt ?? null,
          sharesOutstanding: fin.sharesOutstanding ?? w?.sharesOutstanding ?? null,
        },
        extras: {
          ...merged.extras,
          assets: wr.extras.assets ?? merged.extras?.assets ?? null,
          capex: wr.extras.capex ?? merged.extras?.capex ?? null,
          cfo: wr.extras.cfo ?? merged.financials.cfo ?? merged.extras?.cfo ?? null,
          opPrior: merged.extras?.opPrior ?? wr.extras.opPrior ?? null,
          omChange: merged.extras?.omChange ?? wr.extras.omChange ?? null,
          nm: merged.extras?.nm ?? wr.extras.nm ?? null,
          statementBasis: wr.extras.statementBasis ?? merged.extras?.statementBasis ?? null,
          periodType: merged.extras?.periodType ?? wr.extras.periodType ?? "Annual",
          fiscalYear: merged.extras?.fiscalYear ?? wr.extras.fiscalYear ?? null,
          roic: merged.extras?.roic ?? null,
        },
      };
    }
  }

  merged.sourceAttempts = attempts;
  return overlayIdentity(merged);
}
