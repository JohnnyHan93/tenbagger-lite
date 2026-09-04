import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8080";
const SMOKE = [
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

fs.mkdirSync("/workspace/data", { recursive: true });

async function waitOperator(page) {
  await page.goto(`${BASE}/queue?operator=v24`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__idtOperator), { timeout: 60_000 });
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
page.setDefaultTimeout(180_000);
await waitOperator(page);

const dump0 = await page.evaluate(() => window.__idtOperator.dump());
console.log("[restore] before", dump0.universe, dump0.counts);

const results = [];
for (let i = 0; i < SMOKE.length; i += 3) {
  const batch = SMOKE.slice(i, i + 3);
  console.log("[restore] batch", batch);
  const part = await Promise.all(
    batch.map(async (ticker) => {
      try {
        return await page.evaluate(async (t) => window.__idtOperator.researchOne(t), ticker);
      } catch (err) {
        return { ok: false, ticker, error: String(err) };
      }
    }),
  );
  results.push(...part);
  console.log("[restore] done", part);
}

try {
  await page.evaluate(() => window.__idtOperator.checkpoint());
} catch (err) {
  console.log("[restore] checkpoint", String(err));
}

const dump1 = await page.evaluate(() => window.__idtOperator.dump());
fs.writeFileSync("/workspace/data/smoke-restore.json", JSON.stringify({ results, dump: dump1 }, null, 2));
console.log("[restore] after", dump1.universe, dump1.counts, dump1.preserved);
await browser.close();

if (dump1.universe.analyzed !== 3 || dump1.universe.remaining !== 97) {
  console.error("[restore] FAIL expected analyzed=3 remaining=97");
  process.exit(2);
}
if (dump1.universe.extraSmoke < 9) {
  console.error("[restore] FAIL extra smoke", dump1.universe.extraSmoke);
  process.exit(2);
}
process.exit(0);
