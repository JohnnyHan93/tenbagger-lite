import type { Currency, FinancialSnapshot, ResearchQuote } from "../types.ts";
import { currencyOf, emptyFinancials, parseUserMoney } from "./quote-parse.ts";

export type QuoteOverrides = {
  companyName?: string;
  exchange?: string;
  currency?: Currency;
  price?: number;
  marketCap?: number;
  country?: string;
  sector?: string;
  industry?: string;
  financials?: Partial<FinancialSnapshot>;
};

export function quoteIsUsable(q: ResearchQuote | null): q is ResearchQuote {
  return !!(q && q.ticker && q.price > 0 && q.marketCap > 0);
}

export function missingQuoteFields(q: ResearchQuote | null): string[] {
  const miss: string[] = [];
  if (!q?.ticker) miss.push("ticker");
  if (!(q && q.price > 0)) miss.push("price");
  if (!(q && q.marketCap > 0)) miss.push("marketCap");
  return miss;
}

function positive(n: number | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function applyQuoteOverrides(
  quote: ResearchQuote | null,
  overrides: QuoteOverrides | undefined,
  ticker: string,
): ResearchQuote | null {
  const t = ticker.trim().toUpperCase();
  if (!quote && !overrides) return null;
  const base: ResearchQuote = quote ?? {
    ticker: t,
    exchange: /^\d{6}/.test(t) ? "KRX" : "",
    companyName: t,
    currency: /^\d{6}/.test(t) ? "KRW" : "USD",
    price: 0,
    marketCap: 0,
    enterpriseValue: 0,
    country: /^\d{6}/.test(t) ? "KR" : "",
    sector: "",
    industry: "",
    financials: emptyFinancials(),
  };
  if (!overrides) return base;
  const price = positive(overrides.price) ?? base.price;
  const marketCap = positive(overrides.marketCap) ?? base.marketCap;
  const fin: FinancialSnapshot = {
    ...base.financials,
    ...Object.fromEntries(
      Object.entries(overrides.financials ?? {}).filter(([, v]) => typeof v === "number" && Number.isFinite(v)),
    ),
  };
  if (fin.operatingMargin == null && fin.revenueTtm && fin.operatingIncomeTtm != null && fin.revenueTtm !== 0) {
    fin.operatingMargin = fin.operatingIncomeTtm / fin.revenueTtm;
  }
  return {
    ...base,
    ticker: t || base.ticker,
    companyName: overrides.companyName?.trim() || base.companyName,
    exchange: overrides.exchange?.trim() || base.exchange,
    currency: overrides.currency ? currencyOf(overrides.currency) : base.currency,
    price,
    marketCap,
    enterpriseValue: base.enterpriseValue > 0 ? base.enterpriseValue : marketCap,
    country: overrides.country?.trim() || base.country,
    sector: overrides.sector?.trim() || base.sector,
    industry: overrides.industry?.trim() || base.industry,
    financials: fin,
    sourceAttempts: [
      ...(base.sourceAttempts ?? []),
      {
        provider: "manual-override",
        requestedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "ok",
        notes: "user filled missing quote fields",
      },
    ],
  };
}

export { parseUserMoney };
