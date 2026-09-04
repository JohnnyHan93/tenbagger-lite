import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8080";
const MISSING = [
  { ticker: "NVDA", adapter: "Semiconductor" },
  { ticker: "UNH", adapter: "Healthcare" },
  { ticker: "ASTS", adapter: "Telecom" },
  { ticker: "JPM", adapter: "Financial" },
  { ticker: "PLD", adapter: "REIT" },
  { ticker: "005930.KS", adapter: "Semiconductor" },
  { ticker: "196170.KQ", adapter: "Biotech" },
  { ticker: "356680.KQ", adapter: "Cybersecurity" },
];
const ALL = [
  "MSFT",
  "NVDA",
  "INOD",
  "ASTS",
  "UNH",
  "JPM",
  "PLD",
  "005930.KS",
  "267260.KS",
  "196170.KQ",
  "105560.KS",
  "356680.KQ",
];
const REFRESH = ["NVDA", "UNH", "ASTS", "005930.KS", "267260.KS", "196170.KQ"];

async function analyzeOne(page, ticker) {
  await page.goto(`${BASE}/discover`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.locator("input").first().fill(ticker);
  await page.getByRole("button", { name: /ANALYZE|분석/ }).first().click();
  const started = Date.now();
  while (Date.now() - started < 70_000) {
    const body = await page.innerText("body");
    if (!body.includes("분석 중") && (body.includes("Coverage") || /INVALID|실패|확인하지/.test(body))) {
      return { ok: body.includes("Coverage"), ms: Date.now() - started, body: body.slice(0, 200) };
    }
    await page.waitForTimeout(300);
  }
  return { ok: false, ms: 70_000, body: "TIMEOUT" };
}

async function readCompany(page, ticker) {
  const cands = [ticker];
  if (/^\d{6}$/.test(ticker)) cands.push(`${ticker}.KS`, `${ticker}.KQ`);
  const base = ticker.replace(/\.(KS|KQ)$/i, "");
  if (base !== ticker) cands.push(base);
  for (const t of cands) {
    await page.goto(`${BASE}/company/${encodeURIComponent(t)}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    const body = await page.innerText("body");
    if (body.includes("종목을 찾을 수 없습니다") || body.includes("신원만") || body.includes("Identity only")) continue;
    return { ticker: t, body, ok: body.includes("Coverage") };
  }
  return { ticker, body: "", ok: false };
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const analyzed = [];
for (const row of MISSING) {
  console.log("ANALYZE", row.ticker);
  const r = await analyzeOne(page, row.ticker);
  const co = await readCompany(page, row.ticker);
  analyzed.push({
    ticker: row.ticker,
    resolved: co.ticker,
    ok: r.ok || co.ok,
    ms: r.ms,
    adapter: co.body.includes(`Adapter ${row.adapter}`),
  });
  console.log(JSON.stringify(analyzed.at(-1)));
}

await page.waitForTimeout(1500);
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

const retained = [];
for (const t of ALL) {
  const co = await readCompany(page, t);
  retained.push({ ticker: t, resolved: co.ticker, retained: co.ok });
}
console.log("RETAINED", JSON.stringify(retained));

const refreshRows = [];
for (const t of REFRESH) {
  console.log("REFRESH", t);
  const before = await readCompany(page, t);
  if (!before.ok) {
    refreshRows.push({ ticker: t, skip: true });
    continue;
  }
  await page.goto(`${BASE}/company/${encodeURIComponent(before.ticker)}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const btn = page.getByRole("button", { name: /Refresh/ });
  if (await btn.count()) {
    await btn.first().click();
    const start = Date.now();
    while (Date.now() - start < 70_000) {
      const body = await page.innerText("body");
      if (!body.includes("Refresh 중")) break;
      await page.waitForTimeout(300);
    }
  }
  const histBtn = page.getByRole("button", { name: /History/ });
  if (await histBtn.count()) await histBtn.first().click();
  await page.waitForTimeout(250);
  const after = await page.innerText("body");
  const dates = after.match(/20\d{2}-\d{2}-\d{2}/g) || [];
  refreshRows.push({
    ticker: t,
    dates: dates.length,
    hasDelta: after.includes("Δcov") || after.includes("factor"),
    twoPlus: dates.length >= 2,
  });
  console.log(JSON.stringify(refreshRows.at(-1)));
}

const report = {
  analyzed,
  retained,
  refreshRows,
  analyzedOk: analyzed.filter((a) => a.ok).length,
  retainedOk: retained.filter((a) => a.retained).length,
};
fs.writeFileSync("/workspace/screenshots/smoke12-report.json", JSON.stringify(report, null, 2));
console.log("DONE", JSON.stringify({ analyzedOk: report.analyzedOk, retainedOk: report.retainedOk, refresh: refreshRows }));
await browser.close();
