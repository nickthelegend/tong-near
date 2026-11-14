// Live v2 rehearsal on NEAR testnet through the real relayer code path (no HTTP): a fresh EVM key
// creates a named account, wraps NEAR on wrap.testnet, is refused over the cap, sends NEAR, grants the
// NEAR guestbook, signs it, and asks Chain Signatures for a Sepolia signature. Writes deployments/v2/rehearsal.json.
import { Wallet } from "ethers";
import { randomBytes } from "node:crypto";
import { Account, KeyPair, KeyPairSigner, JsonRpcProvider } from "near-api-js";
import { appendFile } from "node:fs/promises";
import { load, save } from "./common.mjs";
import { TESTNET_RPC, TYPES, typedDomain, domainFor, evmWallet, view, validateRequest, deriveSepoliaAddress } from "../packages/sdk/src/index.mjs";
import { Budget, relay } from "../packages/relayer/src/core.mjs";
const config = await load("deployments/testnet.json");
const c = await load(".near-credentials/relayer.json");
const account = new Account(c.account_id, new JsonRpcProvider({ url: TESTNET_RPC }), new KeyPairSigner(KeyPair.fromString(c.secret_key)));
const budget = new Budget(".demo/relayer-budget.json", { maxCost: 10n * 10n ** 24n, maxCalls: 100 });
const record = (e) => appendFile("deployments/relayer-transactions.jsonl", JSON.stringify(e) + "\n");
const wallet = new Wallet("0x" + randomBytes(32).toString("hex"));
const id = evmWallet(wallet.address);
const name = process.env.NAME ?? `rehearsal-${Date.now().toString(36).slice(-5)}`;
const steps = [];
async function act(label, action, data) {
  const identity = await view(config.contract_id, "get_identity", { wallet: id });
  const request = validateRequest({ domain: domainFor(config.contract_id), wallet: id, action, data: JSON.stringify(data), nonce: identity?.nonce ?? "0", deadline: String(Math.floor(Date.now() / 1000) + 240) }, config.contract_id);
  const signature = await wallet.signTypedData(typedDomain(request.domain), TYPES, request);
  const out = await relay({ authorization: { request, signature }, contractId: config.contract_id, account, rpcUrl: TESTNET_RPC, budget, record });
  steps.push({ label, action, ok: out.ok, txHash: out.txHash, reason: out.reason ?? null });
  console.log(`${out.ok ? "OK     " : "REFUSED"} ${label}: ${out.txHash}${out.reason ? " · " + out.reason : ""}`);
  return out;
}
await act("create named account", "link", { name });
await act("wrap 0.1 NEAR on wrap.testnet", "call", { contract: "wrap.testnet", method: "near_deposit", args: "{}", deposit: String(10n ** 23n) });
await act("wrap 0.5 NEAR (over the cap)", "call", { contract: "wrap.testnet", method: "near_deposit", args: "{}", deposit: String(5n * 10n ** 23n) });
await act("guestbook before any permission", "call", { contract: "guestbook.near-examples.testnet", method: "add_message", args: JSON.stringify({ text: "hello" }), deposit: "0" });
await act("grant the NEAR guestbook", "grant", { contract: "guestbook.near-examples.testnet", methods: ["add_message"], max_deposit: "0", days: 7 });
await act("sign the NEAR guestbook", "call", { contract: "guestbook.near-examples.testnet", method: "add_message", args: JSON.stringify({ text: `Signed with an Ethereum wallet through Tong (${name})` }), deposit: "0" });
await act("send 0.05 NEAR", "send_near", { to: c.account_id, amount: String(5n * 10n ** 22n) });
const identity = await view(config.contract_id, "get_identity", { wallet: id });
const wnear = await view("wrap.testnet", "ft_balance_of", { account_id: identity.account_id });
const sepolia = await deriveSepoliaAddress(identity.account_id);
await save("deployments/v2/rehearsal.json", { at: new Date().toISOString(), factory: config.contract_id, wallet: id, account_id: identity.account_id, wnear, sepolia, policy: identity.policy, steps });
console.log({ account: identity.account_id, wnear, spent: identity.policy.spent_today, sepolia });
