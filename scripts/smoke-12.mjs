import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8080";
const SMOKE = [
  { ticker: "MSFT", name: "Microsoft", adapter: "Software" },
  { ticker: "NVDA", name: "NVIDIA", adapter: "Semiconductor" },
  { ticker: "INOD", name: "Innodata", adapter: "Software" },
  { ticker: "ASTS", name: "AST SpaceMobile", adapter: "Telecom" },
  { ticker: "UNH", name: "UnitedHealth", adapter: "Healthcare" },
  { ticker: "JPM", name: "JPMorgan", adapter: "Financial" },
  { ticker: "PLD", name: "Prologis", adapter: "REIT" },
  { ticker: "005930", name: "삼성전자", adapter: "Semiconductor" },
  { ticker: "267260", name: "HD현대일렉트릭", adapter: "Industrial" },
  { ticker: "196170", name: "알테오젠", adapter: "Biotech" },
  { ticker: "105560", name: "KB금융", adapter: "Financial" },
  { ticker: "356680", name: "엑스게이트", adapter: "Cybersecurity" },
];
const REFRESH = ["NVDA", "UNH", "ASTS", "005930", "267260", "196170"];

function encodeTicker(t) {
  return encodeURIComponent(t);
}

async function waitHydrated(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

async function analyzeOne(page, ticker) {
  await page.goto(`${BASE}/discover`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const input = page.locator("input").first();
  await input.fill(ticker);
  await page.getByRole("button", { name: /ANALYZE|분석/ }).first().click();
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    const body = await page.innerText("body");
    if (!body.includes("분석 중") && (body.includes("Coverage") || body.includes("시가총액") || /INVALID|실패|확인하지/.test(body))) {
      const err = (await page.locator(".text-grade-d").allTextContents().catch(() => []))[0] || "";
      return { body, err, ms: Date.now() - started };
    }
    await page.waitForTimeout(500);
  }
  return { body: await page.innerText("body"), err: "TIMEOUT", ms: 90_000 };
}

async function readCompany(page, ticker) {
  const candidates = [ticker];
  if (/^\d{6}$/.test(ticker)) candidates.push(`${ticker}.KS`, `${ticker}.KQ`);
  for (const t of candidates) {
    const res = await page.goto(`${BASE}/company/${encodeTicker(t)}`, { waitUntil: "domcontentloaded" });
    if (!res || res.status() >= 400) continue;
    await page.waitForTimeout(400);
    const body = await page.innerText("body");
    if (body.includes("종목을 찾을 수 없습니다") || body.includes("Identity only") || body.includes("신원만")) {
      continue;
    }
    return { ticker: t, body };
  }
  return { ticker, body: "" };
}

function classify(body) {
  const statuses = [];
  if (/RESEARCH REQUIRED/.test(body)) statuses.push("RESEARCH REQUIRED");
  if (/\bPARTIAL\b/.test(body)) statuses.push("PARTIAL");
  if (/\bCOMPLETE\b/.test(body)) statuses.push("COMPLETE");
  const failed = body.includes("종목을 찾을 수 없습니다") || body.includes("신원만") || !body.includes("Coverage");
  return { failed, statuses };
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
fs.mkdirSync("/workspace/screenshots", { recursive: true });

await waitHydrated(page);
await page.screenshot({ path: "/workspace/screenshots/smoke12-boot.png" });

const analyzed = [];
for (const row of SMOKE) {
  console.log("ANALYZE", row.ticker);
  const r = await analyzeOne(page, row.ticker);
  const co = await readCompany(page, row.ticker);
  const cls = classify(co.body || r.body);
  const hit = {
    ...row,
    resolved: co.ticker,
    ms: r.ms,
    err: r.err,
    failed: cls.failed,
    statuses: cls.statuses,
    hasCoverage: (co.body || r.body).includes("Coverage"),
    hasEvidence: (co.body || "").includes("Evidence") || (co.body || "").includes("e_"),
    adapter: (co.body || "").includes(row.adapter),
    bodyHasAdapter: (co.body || r.body).includes(`Adapter ${row.adapter}`),
    snippet: (co.body || r.body).slice(0, 280).replace(/\s+/g, " "),
  };
  analyzed.push(hit);
  console.log(JSON.stringify({ ticker: hit.ticker, failed: hit.failed, err: hit.err, ms: hit.ms, adapter: hit.bodyHasAdapter, resolved: hit.resolved }));
}

await page.screenshot({ path: "/workspace/screenshots/smoke12-after-analyze.png" });

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const dashBefore = await page.innerText("body");

// Persistence: clear localStorage, reload
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const dashAfterClear = await page.innerText("body");

const retained = [];
for (const row of SMOKE) {
  const co = await readCompany(page, row.ticker);
  retained.push({
    ticker: row.ticker,
    resolved: co.ticker,
    retained: classify(co.body).failed === false,
    hasCoverage: co.body.includes("Coverage"),
  });
}

// Refresh 6
const refreshRows = [];
for (const t of REFRESH) {
  console.log("REFRESH", t);
  const before = await readCompany(page, t);
  await page.goto(`${BASE}/company/${encodeTicker(before.ticker || t)}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const histBefore = (await page.innerText("body")).split("\n").filter((l) => l.includes("snap") || l.includes("20")).length;
  const btn = page.getByRole("button", { name: /Refresh/ });
  if (await btn.count()) {
    await btn.first().click();
    const start = Date.now();
    while (Date.now() - start < 90_000) {
      const body = await page.innerText("body");
      if (!body.includes("Refresh 중")) break;
      await page.waitForTimeout(400);
    }
  }
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /History/ }).click().catch(() => {});
  await page.waitForTimeout(300);
  const after = await page.innerText("body");
  refreshRows.push({
    ticker: t,
    historyMentions: (after.match(/20\d{2}-/g) || []).length,
    hasDelta: after.includes("Δcov") || after.includes("factor"),
    twoPlus: (after.match(/20\d{2}-/g) || []).length >= 2,
    histBefore,
  });
  console.log(JSON.stringify(refreshRows.at(-1)));
}

await page.screenshot({ path: "/workspace/screenshots/smoke12-history.png" });

const report = {
  analyzed,
  dashBeforeHas100: /유니버스|100/.test(dashBefore),
  dashAfterClear,
  retained,
  refreshRows,
  analyzedOk: analyzed.filter((a) => !a.failed).length,
  retainedOk: retained.filter((a) => a.retained).length,
};
fs.writeFileSync("/workspace/screenshots/smoke12-report.json", JSON.stringify(report, null, 2));
console.log("REPORT", JSON.stringify({ analyzedOk: report.analyzedOk, retainedOk: report.retainedOk, refresh: refreshRows.length }, null, 2));
await browser.close();
