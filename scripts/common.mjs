import { Account, KeyPair, KeyPairSigner, JsonRpcProvider } from "near-api-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { TESTNET_RPC, explorer, rpc } from "../packages/sdk/src/index.mjs";
import { decodeOutcome } from "../packages/relayer/src/core.mjs";
export const root = resolve(import.meta.dirname, "..");
export const sha = (data) => createHash("sha256").update(data).digest("hex");
export async function load(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}
export async function save(path, data) {
  const file = resolve(root, path);
  await mkdir(resolve(file, ".."), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
}
export async function credentials(name, accountId) {
  const path = `.near-credentials/${name}.json`;
  let c = await load(path).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!c) {
    const key = KeyPair.fromRandom("ed25519");
    c = { account_id: accountId, secret_key: key.toString() };
    await mkdir(resolve(root, ".near-credentials"), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(resolve(root, path), JSON.stringify(c), { mode: 0o600 });
  }
  return c;
}
export async function signer(name) {
  const c = await load(`.near-credentials/${name}.json`);
  if (!c.account_id.endsWith(".testnet")) throw new Error("Testnet only");
  return new Account(
    c.account_id,
    new JsonRpcProvider({ url: TESTNET_RPC }),
    new KeyPairSigner(KeyPair.fromString(c.secret_key)),
  );
}
export async function record(label, fn) {
  let outcome;
  try {
    outcome = await fn();
  } catch (error) {
    if (error.transaction_outcome) outcome = error;
    else {
      const rows = await load("deployments/transactions.json").catch(() => []);
      rows.push({
        label,
        at: new Date().toISOString(),
        ok: false,
        txHash: error.context?.transactionHash ?? null,
        error: String(error.message).slice(0, 1000),
      });
      await save("deployments/transactions.json", rows);
      throw new Error(`${label} failed; see deployments/transactions.json`);
    }
  }
  if (outcome.transaction?.hash && outcome.final_execution_status !== "FINAL")
    outcome = await rpc("tx", {
      tx_hash: outcome.transaction.hash,
      sender_account_id: outcome.transaction.signer_id,
      wait_until: "FINAL",
    });
  const result = decodeOutcome(outcome);
  const rows = await load("deployments/transactions.json").catch(() => []);
  rows.push({ label, at: new Date().toISOString(), ...result, outcome });
  await save("deployments/transactions.json", rows);
  console.log(`${label}: ${result.ok ? "final" : "FAILED"} ${result.txHash}`);
  if (!result.ok)
    throw new Error(
      `${label} failed; see recorded receipt ${explorer(result.txHash)}`,
    );
  return { ...result, outcome };
}
