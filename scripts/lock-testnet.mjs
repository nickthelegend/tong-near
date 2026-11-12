import bs58 from "bs58";
import { KeyPair } from "near-api-js";
import { signer, load, save, record, sha } from "./common.mjs";
import { rpc, view } from "../packages/sdk/src/index.mjs";
import { readFile } from "node:fs/promises";
const config = await load("deployments/testnet.json");
const account = await signer("factory");
const state = await rpc("query", {
  request_type: "view_account",
  finality: "final",
  account_id: config.contract_id,
});
const keys = await rpc("query", {
  request_type: "view_access_key_list",
  finality: "final",
  account_id: config.contract_id,
});
const wasm = await readFile("packages/contract/target/near/tong.wasm");
if (Buffer.from(bs58.decode(state.code_hash)).toString("hex") !== sha(wasm))
  throw new Error("Live code hash differs from local WASM");
if (sha(wasm) !== config.contract_sha256)
  throw new Error("Local WASM differs from deployment manifest");
if (
  !(await view(config.contract_id, "get_config")).allowed_actions.includes(
    "sign_sepolia",
  )
)
  throw new Error("Contract not initialized");
const proof = await load("deployments/chain-signature.json");
if (!proof.rawTransaction)
  throw new Error("Run the real Chain Signatures demo before locking");
if (keys.keys.length) {
  const c = await load(".near-credentials/factory.json");
  const pk = KeyPair.fromString(c.secret_key).getPublicKey().toString();
  if (keys.keys.length !== 1 || keys.keys[0].public_key !== pk)
    throw new Error("Unexpected keys; inspect before locking");
  await record("lock factory: delete final full-access key", () =>
    account.deleteKey(pk),
  );
}
const after = await rpc("query", {
  request_type: "view_access_key_list",
  finality: "final",
  account_id: config.contract_id,
});
if (after.keys.length !== 0) throw new Error("Factory still has access keys");
const children = {};
const demo = await load("deployments/demo-identities.json");
for (const [kind, identity] of Object.entries(demo.identities)) {
  const list = await rpc("query", {
    request_type: "view_access_key_list",
    finality: "final",
    account_id: identity.account_id,
  });
  if (list.keys.length) throw new Error("Child still has keys");
  children[kind] = { account_id: identity.account_id, access_keys: 0 };
}
await save("deployments/lock-proof.json", {
  at: new Date().toISOString(),
  factory: config.contract_id,
  access_keys: after.keys,
  code_hash: state.code_hash,
  children,
});
await save("deployments/testnet.json", {
  ...config,
  locked: true,
  locked_at: new Date().toISOString(),
  code_hash: state.code_hash,
});
console.log(
  `Locked ${config.contract_id}: zero access keys. Both demo children are keyless.`,
);
