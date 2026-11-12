import { readFile, writeFile, mkdir } from "node:fs/promises";
const files = [
  "testnet.json",
  "demo-identities.json",
  "chain-signature.json",
  "oneclick-dry-quote.json",
  "sandbox-tests.json",
];
await mkdir("packages/web/public/evidence", { recursive: true });
for (const file of files) {
  try {
    await writeFile(
      `packages/web/public/evidence/${file}`,
      await readFile(`deployments/${file}`),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
