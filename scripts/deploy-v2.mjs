// Deploys the v2 factory (named accounts + on-chain policy) to a fresh testnet account.
// Usage: TONG_FACTORY=tongid.testnet node scripts/deploy-v2.mjs  (then scripts/lock-v2.mjs)
import { KeyPair } from "near-api-js";
import { readFile } from "node:fs/promises";
import { credentials, signer, load, save, record, sha } from "./common.mjs";
import { view, rpc } from "../packages/sdk/src/index.mjs";
const name = process.env.TONG_FACTORY ?? "tongid.testnet";
if (!name.endsWith(".testnet")) throw new Error("Testnet only");
const c = await credentials("factory-v2", name);
if (c.account_id !== name) throw new Error(`factory-v2 credentials are for ${c.account_id}`);
const account = await signer("factory-v2");
let state;
try {
  state = await account.getState();
} catch (error) {
  if (!/does not exist|UNKNOWN_ACCOUNT/i.test(error.message)) throw error;
  const response = await fetch("https://helper.nearprotocol.com/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newAccountId: c.account_id, newAccountPublicKey: KeyPair.fromString(c.secret_key).getPublicKey().toString() }),
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { result = { body: text.slice(0, 1000) }; }
  await save("deployments/v2/faucet.json", { at: new Date().toISOString(), status: response.status, account_id: c.account_id, tx: result?.transaction?.hash ?? null, status_value: result?.status ?? null });
  if (!response.ok) throw new Error(`NEAR faucet HTTP ${response.status}: ${text.slice(0, 300)}`);
  state = await account.getState();
}
console.log(`Factory ${c.account_id}; balance ${state.balance?.total ?? state.amount ?? JSON.stringify(state.balance)}`);
const wasm = await readFile("packages/contract/target/near/tong.wasm");
let initialized = false;
try { await view(c.account_id, "get_config"); initialized = true; } catch {}
const tx = {};
if (!initialized) {
  tx.deploy = (await record("v2: deploy Tong factory", () => account.deployContract(wasm))).txHash;
  tx.init = (await record("v2: initialize Tong factory", () =>
    account.callFunctionRaw({ contractId: c.account_id, methodName: "new", args: {}, gas: 30_000_000_000_000n, deposit: 0n, waitUntil: "FINAL" }))).txHash;
}
const relayer = await load(".near-credentials/relayer.json");
const keys = await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: c.account_id });
const manifest = {
  network: "testnet",
  version: "2",
  contract_id: c.account_id,
  relayer_id: relayer.account_id,
  contract_sha256: sha(wasm),
  account_contract_sha256: sha(await readFile("packages/contract/res/tong_account.wasm")),
  deployed_at: new Date().toISOString(),
  deploy_tx: tx,
  locked: keys.keys.length === 0,
  mpc_contract: "v1.signer-prod.testnet",
  derivation_path: "tong:sepolia:11155111",
  previous: "deployments/v1/testnet.json",
};
await save("deployments/v2/testnet.json", manifest);
await save("deployments/testnet.json", manifest);
console.log(`v2 factory ready: ${c.account_id}`, tx);
