import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractYahooQuoteFromHtml,
  financialsFromNasdaq,
  parseAbbrevMoney,
  parseCommaNumber,
  parseKoreanMoney,
  parseNasdaqMoney,
  quoteFromYahooResult,
} from "./quote-parse.ts";

describe("parseAbbrevMoney", () => {
  it("reads Yahoo streamer abbreviations", () => {
    assert.equal(parseAbbrevMoney("15.249B"), 15.249e9);
    assert.equal(parseAbbrevMoney("1,641.641T"), 1.641641e15);
    assert.equal(parseAbbrevMoney("378.19M"), 378.19e6);
  });
});

describe("parseCommaNumber", () => {
  it("strips nasdaq formatting", () => {
    assert.equal(parseCommaNumber("14,439,987,701"), 14439987701);
    assert.equal(parseCommaNumber("$37.64"), 37.64);
  });
});

describe("parseKoreanMoney", () => {
  it("reads 조/억 units", () => {
    assert.equal(parseKoreanMoney("1,461조 5,697억"), 1_461e12 + 5_697e8);
  });
});

describe("quoteFromYahooResult", () => {
  it("returns a quote without market cap so callers can fill it", () => {
    const q = quoteFromYahooResult("IONQ", {
      price: { regularMarketPrice: { raw: 37.64 }, currency: "USD" },
    });
    assert.ok(q);
    assert.equal(q.price, 37.64);
    assert.equal(q.marketCap, 0);
  });

  it("falls back to summaryDetail.marketCap", () => {
    const q = quoteFromYahooResult("IONQ", {
      price: {
        regularMarketPrice: { raw: 37.64 },
        currency: "USD",
        exchangeName: "NYSE",
        longName: "IonQ, Inc.",
      },
      summaryDetail: { marketCap: { raw: 15_249_305_600 } },
    });
    assert.ok(q);
    assert.equal(q.marketCap, 15_249_305_600);
    assert.equal(q.price, 37.64);
  });
});

describe("extractYahooQuoteFromHtml", () => {
  it("reads quoteSummary embedded in a Remix JSON island", () => {
    const inner = {
      quoteSummary: {
        result: [
          {
            price: {
              shortName: "IonQ, Inc.",
              longName: "IonQ, Inc.",
              currency: "USD",
              regularMarketPrice: { raw: 37.64 },
              marketCap: { raw: 15_249_305_600 },
              exchangeName: "NYSE",
            },
            summaryProfile: {
              country: "United States",
              sector: "Technology",
              industry: "Computer Hardware",
            },
            defaultKeyStatistics: {
              enterpriseValue: { raw: 12_288_827_392 },
              sharesOutstanding: { raw: 405_135_656 },
            },
            financialData: {
              totalCash: { raw: 2_118_968_960 },
              totalDebt: { raw: 54_498_000 },
              totalRevenue: { raw: 246_474_000 },
              grossMargins: { raw: 0.30854 },
              operatingMargins: { raw: -4.08174 },
              profitMargins: { raw: 0 },
              freeCashflow: { raw: -87_774_752 },
            },
          },
        ],
      },
    };
    const html = `<html><script type="application/json">${JSON.stringify({
      status: 200,
      body: JSON.stringify(inner),
    })}</script></html>`;
    const q = extractYahooQuoteFromHtml(html, "IONQ");
    assert.ok(q);
    assert.equal(q.ticker, "IONQ");
    assert.equal(q.companyName, "IonQ, Inc.");
    assert.equal(q.marketCap, 15_249_305_600);
    assert.equal(q.price, 37.64);
    assert.equal(q.financials.revenueTtm, 246_474_000);
    assert.equal(q.financials.sharesOutstanding, 405_135_656);
    assert.equal(q.exchange, "NYSE");
  });

  it("falls back to quoteResponse when quoteSummary is missing", () => {
    const inner = {
      quoteResponse: {
        result: [
          {
            symbol: "005930.KS",
            currency: "KRW",
            shortName: "SamsungElec",
            longName: "Samsung Electronics Co., Ltd.",
            fullExchangeName: "KSE",
            regularMarketPrice: { raw: 250000 },
            marketCap: { raw: 1_641_640_787_705_856 },
            sharesOutstanding: { raw: 5_764_191_903 },
          },
        ],
      },
    };
    const html = `<script type="application/json">${JSON.stringify({
      status: 200,
      body: JSON.stringify(inner),
    })}</script>`;
    const q = extractYahooQuoteFromHtml(html, "005930.KS");
    assert.ok(q);
    assert.equal(q.currency, "KRW");
    assert.equal(q.marketCap, 1_641_640_787_705_856);
    assert.equal(q.country, "KR");
  });

  it("reads data-field=marketCap streamer as last resort", () => {
    const inner = {
      quoteSummary: {
        result: [
          {
            price: {
              regularMarketPrice: { raw: 37.64 },
              currency: "USD",
              longName: "IonQ, Inc.",
            },
          },
        ],
      },
    };
    const html = `<script type="application/json">${JSON.stringify({
      status: 200,
      body: JSON.stringify(inner),
    })}</script><fin-streamer data-field="marketCap">15.249B </fin-streamer>`;
    const q = extractYahooQuoteFromHtml(html, "IONQ");
    assert.ok(q);
    assert.equal(q.marketCap, 15.249e9);
  });
});

describe("parseNasdaqMoney", () => {
  it("reads signed thousands-style cells", () => {
    assert.equal(parseNasdaqMoney("$130,016"), 130016);
    assert.equal(parseNasdaqMoney("-$633,715"), -633715);
    assert.equal(parseNasdaqMoney("--"), null);
  });
});

describe("financialsFromNasdaq", () => {
  it("scales IonQ-style tables from thousands to USD", () => {
    const fin = financialsFromNasdaq({
      data: {
        incomeStatementTable: {
          rows: [
            { value1: "Total Revenue", value2: "$130,016", value3: "$43,073" },
            { value1: "Gross Profit", value2: "$52,528", value3: "$22,476" },
            {
              value1: "Operating Income",
              value2: "-$633,715",
              value3: "-$232,455",
            },
            { value1: "Net Income", value2: "-$510,378", value3: "-$331,647" },
          ],
        },
        balanceSheetTable: {
          rows: [
            {
              value1: "Cash and Cash Equivalents",
              value2: "$1,030,865",
              value3: "$54,393",
            },
            {
              value1: "Short-Term Investments",
              value2: "$1,361,291",
              value3: "$285,896",
            },
            { value1: "Long-Term Debt", value2: "--", value3: "--" },
          ],
        },
        cashFlowTable: {
          rows: [
            {
              value1: "Net Cash Flow-Operating",
              value2: "-$283,187",
              value3: "-$105,683",
            },
          ],
        },
      },
    });
    assert.ok(fin);
    assert.equal(fin.revenueTtm, 130_016_000);
    assert.equal(fin.revenuePrior, 43_073_000);
    assert.equal(fin.operatingIncomeTtm, -633_715_000);
    assert.equal(fin.cash, 1_030_865_000 + 1_361_291_000);
    assert.ok(fin.grossMargin != null && fin.grossMargin > 0.4);
  });
});
