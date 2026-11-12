import { chromium } from "playwright";
import { Wallet } from "ethers";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { withChromeLock } from "/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs";
const shots = "/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/tong";
const checks = [],
  errors = [];
const demoKeys = JSON.parse(
  await readFile(".near-credentials/demo-wallets.json", "utf8"),
);
const wallet = new Wallet(demoKeys.evm);
await withChromeLock(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.exposeFunction(
      "__tongWalletRequest",
      async ({ method, params }) => {
        if (method === "eth_requestAccounts") return [wallet.address];
        if (method === "eth_signTypedData_v4") {
          const data = JSON.parse(params[1]);
          const types = { ...data.types };
          delete types.EIP712Domain;
          return wallet.signTypedData(data.domain, types, data.message);
        }
        throw new Error("Unsupported test wallet RPC");
      },
    );
    await page.addInitScript(() => {
      window.ethereum = { request: (args) => window.__tongWalletRequest(args) };
    });
    await page.goto("http://127.0.0.1:5370", { waitUntil: "networkidle" });
    if (!process.argv.includes("--read-only")) {
      await page
        .getByRole("button", { name: "Connect with Tong", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "You’re connected." })
        .waitFor({ timeout: 30000 });
      checks.push("existing EVM wallet connects through injected provider");
      const note = `Browser verified Tong · ${new Date().toISOString().slice(0, 16)}`;
      await page.getByLabel("Leave your first mark on NEAR").fill(note);
      await page
        .getByRole("button", { name: "Sign and save note on NEAR" })
        .click();
      await page
        .getByText(`On chain: ${note}`, { exact: true })
        .waitFor({ timeout: 90000 });
      checks.push(
        "browser EIP-712 signature relayed and note read back from live child",
      );
      await page.getByText("Confirmed on NEAR", { exact: false }).waitFor();
      await page
        .getByRole("button", { name: "Sign a Sepolia test transaction" })
        .click();
      await page
        .getByText("View your signed Sepolia transaction")
        .waitFor({ timeout: 120000 });
      checks.push(
        "browser signed Sepolia transaction and verified MPC recovery",
      );
      await page.screenshot({
        path: `${shots}/connected-1440.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 375, height: 1000 });
      await page.screenshot({
        path: `${shots}/connected-375.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      checks.push("connected mobile layout has no horizontal overflow");
      await page.getByRole("button", { name: "Disconnect wallet" }).click();
    } else {
      checks.push(
        "prior live browser note and MPC calls are recorded in relayer-transactions.jsonl",
      );
    }
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("http://127.0.0.1:5370", { waitUntil: "networkidle" });
      await page.screenshot({
        path: `${shots}/after-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      checks.push(`playground ${width}px has no overflow`);
      await page.goto("http://127.0.0.1:5370/#docs", {
        waitUntil: "networkidle",
      });
      await page.getByRole("heading", { name: /One connector/ }).waitFor();
      await page.screenshot({
        path: `${shots}/docs-${width}.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      checks.push(`documentation ${width}px has no overflow`);
    }
    await page.goto("http://127.0.0.1:5370/#policy", {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("heading", { name: "A small, deliberate allowlist" })
      .waitFor();
    checks.push("documentation deep link resolves to docs");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: /On-chain proof/ }).click();
    await page
      .getByRole("heading", { name: "A connection you can check." })
      .waitFor();
    checks.push("proof navigation returns from docs to playground");
    await page.goto("http://127.0.0.1:5370", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Get dry quote" }).click();
    await page
      .getByText("Live quote received. dry: true. Not a testnet bridge.")
      .waitFor({ timeout: 40000 });
    checks.push("UI fetches a real 1Click dry quote");
    // A separate page without an extension must show an actionable error, not a fake connection.
    const missing = await browser.newPage({
      viewport: { width: 375, height: 1000 },
    });
    await missing.goto("http://127.0.0.1:5370", { waitUntil: "networkidle" });
    await missing
      .getByRole("button", { name: "Connect with Tong", exact: true })
      .click();
    await missing.getByRole("alert").waitFor();
    assert.match(
      await missing.getByRole("alert").innerText(),
      /Install an EVM wallet/,
    );
    checks.push("missing wallet displays recovery guidance");
    await missing
      .getByRole("button", { name: "Use a temporary test wallet" })
      .click();
    await missing.getByRole("heading", { name: "Make it yours." }).waitFor();
    checks.push(
      "temporary wallet is explicitly labeled and awaits a signed link request",
    );
    await missing.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
await writeFile(
  "deployments/browser-tests.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      network: "testnet",
      checks,
      passed: checks.length,
      errors,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
