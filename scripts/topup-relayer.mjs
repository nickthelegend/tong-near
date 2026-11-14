// Creates a fresh faucet-funded testnet account (NEAR helper, 10 test NEAR) and moves 9.9 NEAR to the
// sponsor relayer. Testnet only; every transfer is appended to deployments/v2/relayer-topups.json.
import { KeyPair, Account, KeyPairSigner, JsonRpcProvider } from "near-api-js";
import { mkdir, writeFile } from "node:fs/promises";
import { load, save, record } from "./common.mjs";
import { TESTNET_RPC } from "../packages/sdk/src/index.mjs";
const relayer = (await load(".near-credentials/relayer.json")).account_id;
const id = `tong-gas-${Date.now().toString(36).slice(-6)}.testnet`;
const key = KeyPair.fromRandom("ed25519");
await mkdir(".near-credentials", { recursive: true, mode: 0o700 });
await writeFile(`.near-credentials/topup-${id}.json`, JSON.stringify({ account_id: id, secret_key: key.toString() }), { mode: 0o600 });
const response = await fetch("https://helper.nearprotocol.com/account", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ newAccountId: id, newAccountPublicKey: key.getPublicKey().toString() }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error(`NEAR faucet HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
await new Promise((r) => setTimeout(r, 3000));
const account = new Account(id, new JsonRpcProvider({ url: TESTNET_RPC }), new KeyPairSigner(key));
const out = await record(`top up sponsor relayer from ${id}`, () => account.transfer({ receiverId: relayer, amount: 99n * 10n ** 23n }));
const log = await load("deployments/v2/relayer-topups.json").catch(() => []);
log.push({ at: new Date().toISOString(), source: id, relayer, amount_yocto: String(99n * 10n ** 23n), txHash: out.txHash });
await save("deployments/v2/relayer-topups.json", log);
console.log(`relayer ${relayer} +9.9 NEAR from ${id}: ${out.txHash}`);
