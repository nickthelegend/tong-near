// Locks the v2 factory: checks the live code hash against the local WASM, deletes the last full-access key,
// and records zero keys on the factory and on every named account listed in deployments/v2/accounts.json.
import bs58 from "bs58";
import { KeyPair } from "near-api-js";
import { readFile } from "node:fs/promises";
import { signer, load, save, record, sha } from "./common.mjs";
import { rpc, view } from "../packages/sdk/src/index.mjs";
const config = await load("deployments/testnet.json");
if (config.version !== "2") throw new Error("deployments/testnet.json is not the v2 factory");
const keysOf = async (id) => (await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: id })).keys;
const state = await rpc("query", { request_type: "view_account", finality: "final", account_id: config.contract_id });
const wasm = await readFile("packages/contract/target/near/tong.wasm");
if (Buffer.from(bs58.decode(state.code_hash)).toString("hex") !== sha(wasm)) throw new Error("Live code hash differs from local WASM");
if ((await view(config.contract_id, "get_config")).version !== "2") throw new Error("Contract not initialized as v2");
let tx = null;
const keys = await keysOf(config.contract_id);
if (keys.length) {
  const c = await load(".near-credentials/factory-v2.json");
  const pk = KeyPair.fromString(c.secret_key).getPublicKey().toString();
  if (keys.length !== 1 || keys[0].public_key !== pk) throw new Error("Unexpected keys; inspect before locking");
  const account = await signer("factory-v2");
  tx = (await record("v2: lock factory (delete final full-access key)", () => account.deleteKey(pk))).txHash;
}
if ((await keysOf(config.contract_id)).length) throw new Error("Factory still has access keys");
const named = (await load("deployments/v2/accounts.json").catch(() => [])) ?? [];
const children = {};
for (const id of named) children[id] = { access_keys: (await keysOf(id)).length };
if (Object.values(children).some((c) => c.access_keys)) throw new Error("A named account has keys");
await save("deployments/v2/lock-proof.json", { at: new Date().toISOString(), factory: config.contract_id, lock_tx: tx, access_keys: [], code_hash: state.code_hash, children });
const manifest = { ...config, locked: true, locked_at: new Date().toISOString(), code_hash: state.code_hash, lock_tx: tx ?? config.lock_tx };
await save("deployments/testnet.json", manifest);
await save("deployments/v2/testnet.json", manifest);
console.log(`Locked ${config.contract_id}: zero access keys (${tx ?? "already locked"}).`);
