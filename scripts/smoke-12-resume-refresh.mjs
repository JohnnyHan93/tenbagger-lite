import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8080";
const REMAINING = ["005930.KS", "267260.KS", "196170.KQ"];
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

async function openCompany(page, ticker) {
  const cands = [ticker, ticker.replace(/\.(KS|KQ)$/i, "")];
  for (const t of cands) {
    await page.goto(`${BASE}/company/${encodeURIComponent(t)}`, { waitUntil: "domcontentloaded" });
    const start = Date.now();
    let body = "";
    while (Date.now() - start < 8000) {
      body = await page.innerText("body");
      if (
        !body.includes("불러오는 중") &&
        (body.includes("Coverage") || body.includes("신원만") || body.includes("종목을 찾을 수 없습니다"))
      ) {
        break;
      }
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

const refresh = [];
for (const ticker of REMAINING) {
  const opened = await openCompany(page, ticker);
  if (!opened.body.includes("Coverage")) {
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
  await page.waitForTimeout(400);
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
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const dash = await page.innerText("body");
const analyzed = (dash.match(/분석됨[\s\n]*(\d+)/) || [])[1] || "";
const afterLs = [];
for (const ticker of ALL) {
  const { body } = await openCompany(page, ticker);
  afterLs.push({
    ticker,
    retained: body.includes("Coverage"),
    adapter: (body.match(/Adapter [A-Za-z]+/) || [])[0] || "",
  });
}

const fake = /Northline|Harbor Forge|Redridge|에코반도체장비|한강생활|서해모빌리티/.test(dash);
const report = { refresh, afterLs, dashAnalyzed: analyzed, fakeDemoPresent: fake };
fs.mkdirSync("/workspace/screenshots", { recursive: true });
fs.writeFileSync("/workspace/screenshots/smoke12-resume.json", JSON.stringify(report, null, 2));
await page.screenshot({ path: "/workspace/screenshots/smoke12-persist.png", fullPage: true });
console.log("DONE", JSON.stringify({
  refreshOk: refresh.filter((r) => r.immutable).length,
  retained: afterLs.filter((a) => a.retained).length,
  analyzed,
  fake,
}));
await browser.close();
