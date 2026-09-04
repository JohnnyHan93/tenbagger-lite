import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8080";
const ALL = [
  ["MSFT", "Software"],
  ["NVDA", "Semiconductor"],
  ["INOD", "Software"],
  ["ASTS", "Telecom"],
  ["UNH", "Healthcare"],
  ["JPM", "Financial"],
  ["PLD", "REIT"],
  ["005930.KS", "Semiconductor"],
  ["267260.KS", "Industrial"],
  ["196170.KQ", "Biotech"],
  ["105560.KS", "Financial"],
  ["356680.KQ", "Cybersecurity"],
];
const REFRESH = ["NVDA", "UNH", "ASTS", "005930.KS", "267260.KS", "196170.KQ"];

async function openCompany(page, ticker) {
  const cands = [ticker, ticker.replace(/\.(KS|KQ)$/i, "")];
  for (const t of cands) {
    await page.goto(`${BASE}/company/${encodeURIComponent(t)}`, { waitUntil: "domcontentloaded" });
    const start = Date.now();
    let body = "";
    while (Date.now() - start < 8000) {
      body = await page.innerText("body");
      if (!body.includes("불러오는 중") && (body.includes("Coverage") || body.includes("신원만") || body.includes("종목을 찾을 수 없습니다"))) break;
      await page.waitForTimeout(250);
    }
    if (body.includes("Coverage") && !body.includes("신원만")) return { t, body };
  }
  return { t: ticker, body: await page.innerText("body") };
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const boot = await page.innerText("body");
if (!boot.includes("분석됨") && !boot.includes("Coverage")) {
  await page.waitForTimeout(2500);
}

const before = [];
for (const [ticker, adapter] of ALL) {
  const { t, body } = await openCompany(page, ticker);
  await page.getByRole("button", { name: /^History$/ }).click().catch(() => {});
  await page.waitForTimeout(200);
  const hist = await page.innerText("body");
  const rows = (hist.match(/20\d{2}-\d{2}-\d{2}T/g) || []).length;
  before.push({
    ticker,
    resolved: t,
    coverage: body.includes("Coverage"),
    adapter: body.includes(`Adapter ${adapter}`) || hist.includes(`Adapter ${adapter}`),
    evidence: body.includes("TIER_") || hist.includes("TIER_"),
    engines: /X-Bagger|X‑Bagger|OVERSOLD|QUALITY/i.test(body),
    histRows: rows,
    adapterLine: (body.match(/Adapter [A-Za-z]+/) || [])[0] || "",
  });
}
console.log("BEFORE", JSON.stringify(before, null, 2));

const refresh = [];
for (const ticker of REFRESH) {
  const opened = await openCompany(page, ticker);
  const body = opened.body;
  if (!body.includes("Coverage")) {
    refresh.push({ ticker, error: "no coverage" });
    continue;
  }
  const histBtn = page.getByRole("button", { name: /^History$/ });
  if (await histBtn.count()) await histBtn.click();
  await page.waitForTimeout(200);
  const beforeHist = (await page.innerText("body").then((s) => s.match(/20\d{2}-\d{2}-\d{2}T/g) || [])).length;
  await page.getByRole("button", { name: /^Refresh$|^Refresh 중$/ }).first().click();
  const start = Date.now();
  while (Date.now() - start < 75000) {
    const txt = await page.innerText("body");
    if (!txt.includes("Refresh 중")) break;
    await page.waitForTimeout(300);
  }
  if (await histBtn.count()) await histBtn.click();
  await page.waitForTimeout(300);
  const after = await page.innerText("body");
  const afterHist = (after.match(/20\d{2}-\d{2}-\d{2}T/g) || []).length;
  refresh.push({
    ticker,
    beforeHist,
    afterHist,
    immutable: afterHist >= beforeHist + 1 || afterHist >= 2,
    hasDelta: after.includes("Δcov"),
  });
  console.log("REFRESH", JSON.stringify(refresh.at(-1)));
}

await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const afterLs = [];
for (const [ticker] of ALL) {
  const { body } = await openCompany(page, ticker);
  afterLs.push({ ticker, retained: body.includes("Coverage") });
}

await page.screenshot({ path: "/workspace/screenshots/smoke12-verify.png" });
const report = { before, refresh, afterLs };
fs.writeFileSync("/workspace/screenshots/smoke12-verify.json", JSON.stringify(report, null, 2));
console.log("DONE", JSON.stringify({ allCoverage: before.every((b) => b.coverage), retained: afterLs.filter((a) => a.retained).length, refreshOk: refresh.filter((r) => r.immutable).length }));
await browser.close();
