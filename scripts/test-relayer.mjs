import assert from "node:assert/strict";
import { Wallet } from "ethers";
import { readFile } from "node:fs/promises";
import { load, save } from "./common.mjs";
import {
  view,
  TYPES,
  typedDomain,
  domainFor,
  evmWallet,
} from "../packages/sdk/src/index.mjs";
const config = await load("deployments/testnet.json");
const keys = await load(".near-credentials/demo-wallets.json");
const key = new Wallet(keys.evm);
const wallet = evmWallet(key.address);
const checks = [];
const endpoint = "http://127.0.0.1:5371/api/relay";
const identity = await view(config.contract_id, "get_identity", { wallet });
const request = {
  domain: domainFor(config.contract_id),
  wallet,
  action: "set_note",
  data: JSON.stringify({ note: "Tong browser + relayer verified on testnet." }),
  nonce: identity.nonce,
  deadline: String(Math.floor(Date.now() / 1000) + 240),
};
const signature = await key.signTypedData(
  typedDomain(request.domain),
  TYPES,
  request,
);
const call = async (body) => {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};
let r = await call({ request, signature: "0x00" });
assert.equal(r.status, 400);
assert.match(r.body.error, /Invalid wallet signature/);
checks.push("invalid signature rejected before gas budget reservation");
const before = JSON.parse(await readFile(".demo/relayer-budget.json", "utf8"));
r = await call({ request, signature });
assert.equal(r.status, 200, JSON.stringify(r));
assert.equal(r.body.ok, true);
checks.push("current relayer policy sponsors a real signed note");
const after = JSON.parse(await readFile(".demo/relayer-budget.json", "utf8"));
assert.equal(after.calls, before.calls + 1);
assert.equal(BigInt(after.reserved) - BigInt(before.reserved), 10n ** 23n);
checks.push("0.1 test NEAR gas reserve persisted before submission");
r = await call({ request, signature });
assert.equal(r.status, 400);
assert.match(r.body.error, /nonce|replay/);
assert.deepEqual(
  JSON.parse(await readFile(".demo/relayer-budget.json", "utf8")),
  after,
);
checks.push("replay rejected without another budget reservation");
const state = await view(identity.account_id, "get_state");
assert.equal(state.note, JSON.parse(request.data).note);
checks.push("live child read-back matches signed data");
await save("deployments/relayer-tests.json", {
  at: new Date().toISOString(),
  passed: checks.length,
  checks,
});
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
