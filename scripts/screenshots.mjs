import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import {
  withChromeLock,
  LOCK,
} from "/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs";
const dir =
  process.env.TONG_SCREENSHOT_DIR ??
  "/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/tong";
const phase = process.argv[2] ?? "after";
await mkdir(dir, { recursive: true });
// Notice short free intervals before joining the helper's 20-second retry loop.
// withChromeLock remains the sole owner of acquisition/release and browser lifetime.
while (existsSync(LOCK)) {
  try {
    if (Date.now() - statSync(LOCK).mtimeMs > 15 * 60_000) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}
await withChromeLock(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const width of [1440, 375]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1,
      });
      await page.goto("http://127.0.0.1:5370", { waitUntil: "networkidle" });
      await writeFile(
        `${dir}/${phase}-${width}-layout.json`,
        JSON.stringify(
          await page.evaluate(() => {
            const selectors = [
              ".site-header",
              ".hero",
              ".hero-story h1",
              ".hero-description",
              ".hero-story>.text-link",
              ".hero-object",
              ".connect-workbench",
              ".connection-route",
              ".proof-section",
              ".funds-section",
              ".developer-strip",
              "footer",
            ];
            return Object.fromEntries(
              selectors.map((selector) => {
                const e = document.querySelector(selector);
                const r = e.getBoundingClientRect();
                const s = getComputedStyle(e);
                return [
                  selector,
                  {
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                    fontSize: s.fontSize,
                    lineHeight: s.lineHeight,
                  },
                ];
              }),
            );
          }),
          null,
          2,
        ),
      );
      await page.screenshot({
        path: `${dir}/${phase}-${width}.png`,
        fullPage: true,
      });
      console.log(
        `${phase} ${width}: ${await page.title()}; overflow ${await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
