import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Transaction } from "ethers";
import bs58 from "bs58";
import { load, save, sha } from "./common.mjs";
import {
  rpc,
  view,
  deriveSepoliaAddress,
  unsignedSepolia,
} from "../packages/sdk/src/index.mjs";
const deployment = await load("deployments/testnet.json");
const rows = await load("deployments/transactions.json");
const checks = [];
for (const row of rows) {
  if (!row.txHash || !row.outcome?.transaction?.signer_id) continue;
  const outcome = await rpc("tx", {
    tx_hash: row.txHash,
    sender_account_id: row.outcome.transaction.signer_id,
    wait_until: "FINAL",
  });
  assert.ok(!outcome.status.Failure, `failed transaction ${row.txHash}`);
  row.outcome = outcome;
  row.final_execution_status = outcome.final_execution_status;
  checks.push(`final transaction: ${row.label}`);
}
await save("deployments/transactions.json", rows);
const state = await rpc("query", {
  request_type: "view_account",
  account_id: deployment.contract_id,
  finality: "final",
});
assert.equal(
  Buffer.from(bs58.decode(state.code_hash)).toString("hex"),
  sha(await readFile("packages/contract/target/near/tong.wasm")),
);
checks.push("live factory code hash matches local optimized WASM");
const lock = await rpc("query", {
  request_type: "view_access_key_list",
  account_id: deployment.contract_id,
  finality: "final",
});
assert.equal(lock.keys.length, 0);
checks.push("locked factory has zero access keys");
const demo = await load("deployments/demo-identities.json");
for (const [kind, wallet] of Object.entries(demo.wallets)) {
  const identity = await view(deployment.contract_id, "get_identity", {
    wallet,
  });
  assert.equal(identity.ready, true);
  const keys = await rpc("query", {
    request_type: "view_access_key_list",
    account_id: identity.account_id,
    finality: "final",
  });
  assert.equal(keys.keys.length, 0);
  const child = await rpc("query", {
    request_type: "view_account",
    account_id: identity.account_id,
    finality: "final",
  });
  assert.equal(
    Buffer.from(bs58.decode(child.code_hash)).toString("hex"),
    deployment.account_contract_sha256,
  );
  assert.ok((await view(identity.account_id, "get_state")).note);
  checks.push(
    `${kind}: identity ready, expected WASM, zero keys, signed note present`,
  );
}
const signed = await load("deployments/chain-signature.json");
const tx = Transaction.from(signed.rawTransaction);
const derived = await deriveSepoliaAddress(signed.predecessor);
assert.equal(tx.from.toLowerCase(), derived.toLowerCase());
assert.equal(tx.unsignedHash, unsignedSepolia(signed.transfer).unsignedHash);
assert.equal(tx.chainId, 11155111n);
checks.push(
  "recorded MPC signature recovers to current derived address and exact Sepolia payload",
);
await save("deployments/verification.json", {
  at: new Date().toISOString(),
  network: "testnet",
  passed: checks.length,
  checks,
});
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
