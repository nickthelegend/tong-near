// Screenshot every route at 1440 and 390 with the read-only demo identity, and measure overflow.
// Usage: OUT=/abs/dir node scripts/ui-shots.mjs   (app must run on 127.0.0.1:5310)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { withChromeLock } from "/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs";
import { installQaWallet, loadWallet } from "./lib/qa-wallet.mjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:5310";
const OUT = process.env.OUT ?? "/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/tong/v2";
const ONLY = process.env.ONLY?.split(",");
mkdirSync(OUT, { recursive: true });
const wallet = loadWallet({ keyFile: ".near-credentials/demo-wallets.json" });
const ROUTES = [
  ["landing", "#/", true],
  ["connect", "#/connect"],
  ["connected", "#/connect", false, "connect"],
  ["account", "#/app"],
  ["apps", "#/app/apps"],
  ["act", "#/app/act"],
  ["sign", "#/app/sign"],
  ["activity", "#/app/activity"],
  ["permissions", "#/app/permissions"],
  ["developers", "#/app/developers"],
];
const report = [];
await withChromeLock(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await installQaWallet(context, wallet);
    const page = await context.newPage();
    for (const [name, hash, full, mode] of ROUTES) {
      if (ONLY && !ONLY.includes(name)) continue;
      await page.goto(`${BASE}/${hash}`);
      if (name === "account") {
        // remember the demo wallet as a read-only identity (public address only)
        await page.evaluate((addr) => {
          localStorage.setItem("tong.wallets", JSON.stringify([{ wallet: `evm:${addr.toLowerCase()}`, kind: "evm", name: "QA test wallet" }]));
          localStorage.setItem("tong.active", JSON.stringify(`evm:${addr.toLowerCase()}`));
        }, wallet.address);
        await page.reload();
      }
      if (mode === "connect") {
        await page.getByText("QA test wallet").first().click();
        await page.waitForTimeout(2500);
      }
      await page.waitForTimeout(4500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const file = `${OUT}/${name}-${w}.png`;
      await page.screenshot({ path: file, fullPage: !!full || w === 390 });
      report.push({ name, width: w, overflow, file });
      console.log(name, w, "overflow", overflow);
    }
    await context.close();
  }
  await browser.close();
});
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
