import { writeFileSync } from "node:fs";
import { resolveQuote } from "../src/lib/research/quote-fetch.ts";
import { gatherResearchPack } from "../src/lib/research/pack.ts";
import { heuristicDraft } from "../src/lib/research/heuristic.ts";
import { materializeAnalysis } from "../src/lib/scoring/pipeline.ts";

const PRIORITY = [
  ["INOD", "Innodata"],
  ["DSP", "Viant Technology"],
  ["MNTN", "MNTN"],
  ["RDVT", "Red Violet"],
  ["BLZE", "Backblaze"],
  ["PGY", "Pagaya"],
  ["PDFS", "PDF Solutions"],
  ["QNST", "QuinStreet"],
  ["EVER", "EverQuote"],
  ["MAX", "MediaAlpha"],
  ["RSKD", "Riskified"],
  ["MITK", "Mitek Systems"],
  ["PAYS", "Paysign"],
  ["BAND", "Bandwidth"],
  ["WEAV", "Weave"],
  ["ACVA", "ACV Auctions"],
  ["ASTH", "Astrana Health"],
  ["CEVA", "CEVA"],
  ["SMWB", "Similarweb"],
  ["ATEX", "Anterix"],
];

const CONDITIONAL = [
  ["PRLB", "Proto Labs"],
  ["ETON", "Eton Pharmaceuticals"],
  ["BLFS", "BioLife Solutions"],
  ["ANAB", "AnaptysBio"],
  ["XERS", "Xeris"],
  ["ALNT", "Allient"],
  ["MGTX", "MeiraGTx"],
  ["LQDT", "Liquidity Services"],
  ["BVS", "Bioventus"],
  ["APPS", "Digital Turbine"],
  ["PD", "PagerDuty"],
  ["NWPX", "NWPX Infrastructure"],
  ["RIGL", "Rigel Pharma"],
  ["NXDR", "Nextdoor"],
  ["VREX", "Varex Imaging"],
  ["MLAB", "Mesa Labs"],
  ["ZVRA", "Zevra Therapeutics"],
  ["SPT", "Sprout Social"],
  ["MTLS", "Materialise"],
  ["ZIP", "ZipRecruiter"],
];

const ALL = [
  ...PRIORITY.map(([ticker, name]) => ({ ticker, name, cohort: "priority" })),
  ...CONDITIONAL.map(([ticker, name]) => ({ ticker, name, cohort: "conditional" })),
];

async function one(item) {
  const quote = await resolveQuote(item.ticker);
  if (!quote || !quote.price || !quote.marketCap) {
    return { ok: false, ticker: item.ticker, error: "NO_QUOTE" };
  }
  const pack = await gatherResearchPack({
    ticker: quote.ticker,
    companyName: quote.companyName || item.name,
    country: quote.country || "US",
  });
  const draft = heuristicDraft(
    {
      ...quote,
      companyName: quote.companyName || item.name,
    },
    pack,
  );
  const companyId = `c_${item.ticker}`;
  const analysis = materializeAnalysis(companyId, draft, "2026-09-03T12:00:00.000Z");
  analysis.id = `a_${item.ticker}_20260903`;
  analysis.createdAt = analysis.analysisDate;
  const company = {
    id: companyId,
    ticker: quote.ticker,
    exchange: quote.exchange || "NASDAQ",
    companyName: quote.companyName || item.name,
    country: quote.country || "US",
    sector: quote.sector || "",
    industry: quote.industry || "",
    cohort: item.cohort,
    createdAt: "2026-09-03T12:00:00.000Z",
    updatedAt: "2026-09-03T12:00:00.000Z",
  };
  return { ok: true, company, analysis };
}

async function pool(items, n) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      try {
        const r = await one(item);
        out[idx] = r;
        const tag = r.ok
          ? `${r.analysis.adjustedScore.toFixed(0)} ${r.analysis.grade} ${r.analysis.verdict}`
          : r.error;
        console.log(`${idx + 1}/${items.length} ${item.ticker} ${tag}`);
      } catch (e) {
        out[idx] = { ok: false, ticker: item.ticker, error: String(e) };
        console.log(`${idx + 1}/${items.length} ${item.ticker} FAIL ${e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

const results = await pool(ALL, 4);
const ok = results.filter((r) => r.ok);
const fail = results.filter((r) => !r.ok);
const payload = {
  generatedAt: new Date().toISOString(),
  companies: ok.map((r) => r.company),
  analyses: ok.map((r) => r.analysis),
  failed: fail,
};
writeFileSync(
  new URL("../src/lib/library-seed.json", import.meta.url),
  JSON.stringify(payload),
);
console.log(`wrote ${ok.length} ok, ${fail.length} fail`);
