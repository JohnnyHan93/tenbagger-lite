import type { Currency, FinancialSnapshot, ResearchQuote } from "../types";

export type YahooRaw = { raw?: number };

export type YahooResult = {
  price?: {
    shortName?: string;
    longName?: string;
    currency?: string;
    regularMarketPrice?: YahooRaw;
    marketCap?: YahooRaw;
    exchangeName?: string;
    symbol?: string;
  };
  summaryDetail?: {
    marketCap?: YahooRaw;
    currency?: string;
  };
  summaryProfile?: {
    country?: string;
    sector?: string;
    industry?: string;
  };
  defaultKeyStatistics?: {
    enterpriseValue?: YahooRaw;
    sharesOutstanding?: YahooRaw;
  };
  financialData?: {
    totalCash?: YahooRaw;
    totalDebt?: YahooRaw;
    totalRevenue?: YahooRaw;
    grossMargins?: YahooRaw;
    operatingMargins?: YahooRaw;
    profitMargins?: YahooRaw;
    freeCashflow?: YahooRaw;
  };
};

export type YahooQuoteResponse = {
  symbol?: string;
  currency?: string;
  shortName?: string;
  longName?: string;
  fullExchangeName?: string;
  exchange?: string;
  regularMarketPrice?: number | YahooRaw;
  marketCap?: number | YahooRaw;
  sharesOutstanding?: number | YahooRaw;
};

export function rawNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "raw" in v) {
    const r = (v as YahooRaw).raw;
    if (typeof r === "number" && Number.isFinite(r)) return r;
  }
  return null;
}

export function parseAbbrevMoney(text: string): number | null {
  const t = text.replace(/,/g, "").replace(/\s+/g, "").trim();
  const m = t.match(/^(-?[0-9]*\.?[0-9]+)([KMBT])?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const mul: Record<string, number> = {
    K: 1e3,
    M: 1e6,
    B: 1e9,
    T: 1e12,
  };
  return n * (mul[m[2]?.toUpperCase() ?? ""] ?? 1);
}

export function parseCommaNumber(text: string): number | null {
  const n = Number(text.replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function parseKoreanMoney(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (!t) return null;
  let n = 0;
  const jo = t.match(/([0-9]+(?:\.[0-9]+)?)\s*조/);
  const eok = t.match(/([0-9]+(?:\.[0-9]+)?)\s*억/);
  const man = t.match(/([0-9]+(?:\.[0-9]+)?)\s*만/);
  if (jo) n += Number(jo[1]) * 1e12;
  if (eok) n += Number(eok[1]) * 1e8;
  if (man) n += Number(man[1]) * 1e4;
  if (n > 0) return n;
  return parseCommaNumber(t.replace(/[^\d.-]/g, ""));
}

export function currencyOf(code?: string): Currency {
  return code === "KRW" ? "KRW" : "USD";
}

export function emptyFinancials(): FinancialSnapshot {
  return {
    revenueTtm: null,
    revenuePrior: null,
    operatingIncomeTtm: null,
    netIncomeTtm: null,
    cash: null,
    totalDebt: null,
    sharesOutstanding: null,
    grossMargin: null,
    operatingMargin: null,
    fcf: null,
  };
}

export function financialsFromYahoo(r: YahooResult): FinancialSnapshot {
  const fin = r.financialData;
  const rev = rawNumber(fin?.totalRevenue);
  const opm = rawNumber(fin?.operatingMargins);
  const npm = rawNumber(fin?.profitMargins);
  return {
    revenueTtm: rev,
    revenuePrior: null,
    operatingIncomeTtm: rev != null && opm != null ? rev * opm : null,
    netIncomeTtm: rev != null && npm != null ? rev * npm : null,
    cash: rawNumber(fin?.totalCash),
    totalDebt: rawNumber(fin?.totalDebt),
    sharesOutstanding: rawNumber(r.defaultKeyStatistics?.sharesOutstanding),
    grossMargin: rawNumber(fin?.grossMargins),
    operatingMargin: opm,
    fcf: rawNumber(fin?.freeCashflow),
  };
}

export function quoteFromYahooResult(
  ticker: string,
  r: YahooResult,
): ResearchQuote | null {
  const price = rawNumber(r.price?.regularMarketPrice);
  const mcap =
    rawNumber(r.price?.marketCap) ?? rawNumber(r.summaryDetail?.marketCap) ?? 0;
  if (price == null) return null;
  const financials = financialsFromYahoo(r);
  const cur = currencyOf(r.price?.currency ?? r.summaryDetail?.currency);
  return {
    ticker,
    exchange: r.price?.exchangeName ?? "",
    companyName: r.price?.longName || r.price?.shortName || ticker,
    currency: cur,
    price,
    marketCap: mcap,
    enterpriseValue: rawNumber(r.defaultKeyStatistics?.enterpriseValue) ?? mcap,
    country:
      r.summaryProfile?.country ??
      (ticker.endsWith(".KS") || ticker.endsWith(".KQ") ? "KR" : "US"),
    sector: r.summaryProfile?.sector ?? "",
    industry: r.summaryProfile?.industry ?? "",
    financials,
  };
}

export function quoteFromYahooQuoteResponse(
  ticker: string,
  r: YahooQuoteResponse,
): ResearchQuote | null {
  const price = rawNumber(r.regularMarketPrice);
  const mcap = rawNumber(r.marketCap);
  if (price == null || !mcap) return null;
  const shares = rawNumber(r.sharesOutstanding);
  return {
    ticker,
    exchange: r.fullExchangeName || r.exchange || "",
    companyName: r.longName || r.shortName || ticker,
    currency: currencyOf(r.currency),
    price,
    marketCap: mcap,
    enterpriseValue: mcap,
    country: ticker.endsWith(".KS") || ticker.endsWith(".KQ") ? "KR" : "US",
    sector: "",
    industry: "",
    financials: { ...emptyFinancials(), sharesOutstanding: shares },
  };
}

function parseScriptJsonBlobs(html: string): unknown[] {
  const blobs: unknown[] = [];
  const re = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const outer = JSON.parse(raw) as unknown;
      if (outer && typeof outer === "object" && "body" in outer) {
        const body = (outer as { body?: unknown }).body;
        if (typeof body === "string") {
          try {
            blobs.push(JSON.parse(body));
            continue;
          } catch {
            blobs.push(outer);
            continue;
          }
        }
      }
      blobs.push(outer);
    } catch {
      // skip malformed island
    }
  }
  return blobs;
}

function marketCapFromStreamer(html: string): number | null {
  const m = html.match(
    /data-field="marketCap"[^>]*>\s*([0-9,.\s]+[KMBT]?)\s*</i,
  );
  if (!m) return null;
  return parseAbbrevMoney(m[1] ?? "");
}

export function extractYahooQuoteFromHtml(
  html: string,
  ticker: string,
): ResearchQuote | null {
  const blobs = parseScriptJsonBlobs(html);
  let fromSummary: ResearchQuote | null = null;
  let fromResponse: ResearchQuote | null = null;

  for (const b of blobs) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const qs = rec.quoteSummary as { result?: YahooResult[] } | undefined;
    const summaryHit = qs?.result?.[0];
    if (summaryHit && !fromSummary) {
      fromSummary = quoteFromYahooResult(ticker, summaryHit);
    }
    const qr = rec.quoteResponse as { result?: YahooQuoteResponse[] } | undefined;
    const responseHit = qr?.result?.[0];
    if (responseHit && !fromResponse) {
      fromResponse = quoteFromYahooQuoteResponse(ticker, responseHit);
    }
  }

  if (fromSummary?.marketCap) return fromSummary;
  if (fromResponse?.marketCap) return fromResponse;

  const streamer = marketCapFromStreamer(html);
  const base = fromSummary ?? fromResponse;
  if (base && !base.marketCap && streamer) {
    return { ...base, marketCap: streamer, enterpriseValue: streamer };
  }
  return null;
}

export type NasdaqStatementTable = {
  headers?: Record<string, string>;
  rows?: Array<Record<string, string>>;
};

export type NasdaqFinancialsPayload = {
  data?: {
    symbol?: string;
    incomeStatementTable?: NasdaqStatementTable;
    balanceSheetTable?: NasdaqStatementTable;
    cashFlowTable?: NasdaqStatementTable;
  };
};

/** Nasdaq company financials print in thousands. */
const NASDAQ_SCALE = 1_000;

export function parseNasdaqMoney(text: string): number | null {
  const t = text.replace(/\s/g, "");
  if (!t || t === "--" || t === "-" || t === "—" || /^n\/?a$/i.test(t)) {
    return null;
  }
  const neg = t.includes("(") || t.startsWith("-");
  const n = Number(t.replace(/[$,()]/g, ""));
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

function nasdaqRow(
  table: NasdaqStatementTable | undefined,
  label: string,
): { latest: number | null; prior: number | null } {
  const row = table?.rows?.find(
    (r) => (r.value1 ?? "").trim().toLowerCase() === label.toLowerCase(),
  );
  if (!row) return { latest: null, prior: null };
  const latest = parseNasdaqMoney(row.value2 ?? "");
  const prior = parseNasdaqMoney(row.value3 ?? "");
  return {
    latest: latest == null ? null : latest * NASDAQ_SCALE,
    prior: prior == null ? null : prior * NASDAQ_SCALE,
  };
}

export function financialsFromNasdaq(
  payload: NasdaqFinancialsPayload,
): FinancialSnapshot | null {
  const data = payload.data;
  if (!data) return null;
  const inc = data.incomeStatementTable;
  const bal = data.balanceSheetTable;
  const cf = data.cashFlowTable;
  const rev = nasdaqRow(inc, "Total Revenue");
  if (rev.latest == null && rev.prior == null) return null;
  const op = nasdaqRow(inc, "Operating Income");
  const ni = nasdaqRow(inc, "Net Income");
  const gp = nasdaqRow(inc, "Gross Profit");
  const cash = nasdaqRow(bal, "Cash and Cash Equivalents");
  const sti = nasdaqRow(bal, "Short-Term Investments");
  const ltd = nasdaqRow(bal, "Long-Term Debt");
  const std = nasdaqRow(
    bal,
    "Short-Term Debt / Current Portion of Long-Term Debt",
  );
  const ocf = nasdaqRow(cf, "Net Cash Flow-Operating");
  const cashNow =
    cash.latest == null && sti.latest == null
      ? null
      : (cash.latest ?? 0) + (sti.latest ?? 0);
  const debtNow =
    ltd.latest == null && std.latest == null
      ? null
      : (ltd.latest ?? 0) + (std.latest ?? 0);
  const gpm =
    gp.latest != null && rev.latest && rev.latest !== 0
      ? gp.latest / rev.latest
      : null;
  const opm =
    op.latest != null && rev.latest && rev.latest !== 0
      ? op.latest / rev.latest
      : null;
  return {
    revenueTtm: rev.latest,
    revenuePrior: rev.prior,
    operatingIncomeTtm: op.latest,
    netIncomeTtm: ni.latest,
    cash: cashNow,
    totalDebt: debtNow,
    sharesOutstanding: null,
    grossMargin: gpm,
    operatingMargin: opm,
    fcf: ocf.latest,
  };
}
