import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const TICKERS = ["MSFT", "JPM", "PLD", "196170.KQ", "INOD", "005930.KS"];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const dash = await page.innerText("body");
console.log("DASH", {
  universe: /100/.test(dash),
  fake: /에코반도체장비|한강생활|서해모빌리티|Northline|SMPL-/.test(dash),
});

for (const t of TICKERS) {
  await page.goto(`${BASE}/company/${encodeURIComponent(t)}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const evBtn = page.getByRole("button", { name: /^Evidence$/ });
  if (await evBtn.count()) await evBtn.click();
  await page.waitForTimeout(200);
  const body = await page.innerText("body");
  console.log(JSON.stringify({
    ticker: t,
    adapter: (body.match(/Adapter [A-Za-z]+/) || [])[0],
    tier: /TIER_[123]|MANUAL/.test(body),
    type: /FACT|REPORTED|INFERENCE/.test(body),
    source: /Nasdaq|Market quote|News|Wise|Naver|Grok|Profile/i.test(body),
    date: /20\d{2}-\d{2}-\d{2}/.test(body),
    engines: /xbagger|oversold|quality/.test(body),
    empty: body.includes("증거가 없습니다"),
  }));
}
await page.screenshot({ path: "/workspace/screenshots/smoke12-evidence.png" });
await browser.close();
