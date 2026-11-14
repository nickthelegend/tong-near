import { rpc, view, TESTNET_RPC } from "@tong/sdk";
import deployment from "../../../../deployments/testnet.json";

export const CONTRACT_ID = deployment.contract_id;
export const DEPLOYMENT = deployment;
export const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const NEARBLOCKS_API = "https://api-testnet.nearblocks.io/v3";

export const nearTx = (hash) => `https://testnet.nearblocks.io/txns/${hash}`;
export const nearAccount = (id) => `https://testnet.nearblocks.io/address/${id}`;
export const sepoliaAddress = (a) => `https://sepolia.etherscan.io/address/${a}`;
export const sepoliaTx = (h) => `https://sepolia.etherscan.io/tx/${h}`;

export const short = (v, head = 6, tail = 4) =>
  v ? (v.length <= head + tail + 1 ? v : `${v.slice(0, head)}…${v.slice(-tail)}`) : "—";

export function shortAccount(id) {
  if (!id) return "—";
  const [hash, ...rest] = id.split(".");
  return hash.length > 16 ? `${hash.slice(0, 6)}…${hash.slice(-4)}.${rest.join(".")}` : id;
}

export function walletLabel(wallet) {
  if (!wallet) return "—";
  if (wallet.startsWith("evm:")) return short(wallet.slice(4), 6, 4);
  return short(wallet.slice(7), 6, 4);
}
export const walletKind = (w) => (w?.startsWith("solana:") ? "solana" : "evm");

const YOCTO = 10n ** 24n;
export function formatNear(yocto, digits = 4) {
  if (yocto === null || yocto === undefined) return "—";
  const v = BigInt(yocto);
  const whole = v / YOCTO;
  const frac = (v % YOCTO).toString().padStart(24, "0").slice(0, digits).replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${frac ? "." + frac : ""}`;
}
export function formatEth(wei, digits = 6) {
  if (wei === null || wei === undefined) return "—";
  const v = BigInt(wei);
  const base = 10n ** 18n;
  const whole = v / base;
  const frac = (v % base).toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  return `${whole}${frac ? "." + frac : ""}`;
}
export function formatWeiSmart(wei) {
  const v = BigInt(wei);
  if (v === 0n) return "0 ETH";
  if (v < 10n ** 12n) return `${v.toLocaleString("en-US")} wei`;
  return `${formatEth(v, 8)} ETH`;
}
export function formatGwei(wei) {
  const v = Number(BigInt(wei)) / 1e9;
  if (v >= 1) return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} gwei`;
  return `${Number(BigInt(wei)).toLocaleString("en-US")} wei`;
}
export function timeAgo(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function viewAccount(id) {
  try {
    return await rpc("query", { request_type: "view_account", finality: "final", account_id: id });
  } catch (e) {
    if (/does not exist|UNKNOWN_ACCOUNT/i.test(e.message)) return null;
    throw e;
  }
}
export async function accessKeys(id) {
  const r = await rpc("query", { request_type: "view_access_key_list", finality: "final", account_id: id });
  return r.keys ?? [];
}
export const getConfig = () => view(CONTRACT_ID, "get_config");
export const getIdentity = (wallet) => view(CONTRACT_ID, "get_identity", { wallet });
export const nameAvailable = (name) => view(CONTRACT_ID, "name_available", { name });
export const accountFor = (name) => view(CONTRACT_ID, "account_for", { name });
export const ownerOf = (accountId) => view(CONTRACT_ID, "owner_of", { account_id: accountId });
export const WRAP = "wrap.testnet";
export const GUESTBOOK = "guestbook.near-examples.testnet";
export async function wnearBalance(accountId) {
  return view(WRAP, "ft_balance_of", { account_id: accountId });
}
export async function guestbookLatest(limit = 6) {
  const total = Number(await view(GUESTBOOK, "total_messages", {}));
  const from = Math.max(0, total - limit);
  const rows = await view(GUESTBOOK, "get_messages", { from_index: String(from), limit: String(limit) });
  return { total, rows: rows.map((r, i) => ({ ...r, index: from + i })).reverse() };
}
/** Today's policy usage, rolled over at the UTC day boundary exactly like the contract does. */
export function policyToday(policy) {
  if (!policy) return null;
  const today = BigInt(Math.floor(Date.now() / 86_400_000));
  const spent = BigInt(policy.day) === today ? BigInt(policy.spent_today) : 0n;
  return { spent, cap: BigInt(policy.daily_cap), left: BigInt(policy.daily_cap) - spent, sendCap: BigInt(policy.send_cap) };
}
export function grantFor(policy, contract) {
  const g = policy?.grants?.find((x) => x.contract === contract);
  if (!g) return null;
  return { ...g, expired: Number(g.expires_at) * 1000 <= Date.now() };
}
export const childState = (id) => view(id, "get_state");
export async function nearGasPrice() {
  return (await rpc("gas_price", [null])).gas_price;
}
export { TESTNET_RPC };

export async function sepolia(method, params = []) {
  const r = await fetch(SEPOLIA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Sepolia RPC HTTP ${r.status}`);
  const b = await r.json();
  if (b.error) throw new Error(b.error.message);
  return b.result;
}
export async function sepoliaSnapshot(address) {
  const [chainId, balance, nonce, gasPrice] = await Promise.all([
    sepolia("eth_chainId"),
    sepolia("eth_getBalance", [address, "latest"]),
    sepolia("eth_getTransactionCount", [address, "pending"]),
    sepolia("eth_gasPrice"),
  ]);
  if (BigInt(chainId) !== 11155111n) throw new Error("Sepolia RPC returned a different network");
  return { balance: BigInt(balance), nonce: BigInt(nonce), gasPrice: BigInt(gasPrice) };
}

const METHOD_LABEL = {
  new: "Account created",
  set_note: "Note saved on NEAR",
  sign_sepolia: "Chain Signature requested",
  sign: "MPC signing request",
  call_app: "App call",
  near_deposit: "Wrapped NEAR",
  near_withdraw: "Unwrapped NEAR",
  add_message: "Guestbook message",
  send_near: "NEAR sent",
  get_state: "Permissions updated",
};
async function nearblocks(path) {
  const r = await fetch(`${NEARBLOCKS_API}${path}`, { signal: AbortSignal.timeout(20000) });
  if (r.status === 429) throw new Error("NearBlocks rate limit reached. Try again in a minute.");
  if (!r.ok) throw new Error(`NearBlocks HTTP ${r.status}`);
  return r.json();
}
export async function accountActivity(accountId) {
  const body = await nearblocks(`/accounts/${accountId}/receipts?limit=50`);
  const byTx = new Map();
  for (const t of body.data ?? []) {
    const hash = t.transaction_hash;
    const methods = (t.actions ?? []).map((a) => a.method || a.action);
    const at = Number(BigInt(t.block?.block_timestamp ?? t.included_in_block_timestamp) / 1_000_000n);
    const prev = byTx.get(hash) ?? { hash, at, methods: [], ok: true, receipts: 0 };
    prev.methods.push(...methods);
    prev.at = Math.min(prev.at, at);
    prev.receipts += 1;
    if (t.outcome && t.outcome.status === false) prev.ok = false;
    byTx.set(hash, prev);
  }
  return [...byTx.values()]
    .map((t) => {
      const key = ["new", "near_deposit", "near_withdraw", "add_message", "send_near", "sign_sepolia", "set_note", "sign", "call_app", "get_state"].find((m) => t.methods.includes(m));
      const kind = key === "new" ? "link" : key === "set_note" ? "note" : ["near_deposit", "near_withdraw", "add_message", "call_app", "get_state"].includes(key) ? "app" : key === "send_near" ? "transfer" : key ? "signature" : "transfer";
      return { ...t, kind, label: METHOD_LABEL[key] ?? "Account receipt" };
    })
    .sort((a, b) => b.at - a.at);
}
export async function factoryLatest() {
  const body = await nearblocks(`/accounts/${CONTRACT_ID}/txns?limit=25`);
  return (body.data ?? []).map((t) => ({
    hash: t.transaction_hash,
    at: Number(BigInt(t.block_timestamp) / 1_000_000n),
    ok: t.outcomes?.status !== false,
    deposit: t.actions_agg?.deposit ?? "0",
  }));
}
export async function relayerHealth() {
  const r = await fetch("/api/health", { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("Relayer offline");
  return r.json();
}

/* Full receipt of a Tong transaction, straight from NEAR RPC (the relayer is always the signer). */
export async function txReceipt(hash) {
  const r = await rpc("tx", { tx_hash: hash, sender_account_id: DEPLOYMENT.relayer_id, wait_until: "FINAL" });
  const outcomes = [r.transaction_outcome, ...r.receipts_outcome];
  const gas = outcomes.reduce((n, o) => n + BigInt(o.outcome.gas_burnt), 0n);
  const fee = outcomes.reduce((n, o) => n + BigInt(o.outcome.tokens_burnt), 0n);
  const logs = r.receipts_outcome.flatMap((o) => o.outcome.logs);
  let event = null;
  for (const l of logs) {
    try {
      const j = JSON.parse(l);
      if (j.standard === "tong") event = j.data?.[0] ?? null;
    } catch {
      /* non-JSON log */
    }
  }
  const failed = !!r.status?.Failure || r.receipts_outcome.some((o) => o.outcome.status?.Failure);
  return {
    ok: !failed,
    signer: r.transaction.signer_id,
    receiver: r.transaction.receiver_id,
    method: r.transaction.actions?.[0]?.FunctionCall?.method_name ?? "—",
    deposit: r.transaction.actions?.[0]?.FunctionCall?.deposit ?? "0",
    block: r.transaction_outcome.block_hash,
    receipts: r.receipts_outcome.length,
    executors: [...new Set(r.receipts_outcome.map((o) => o.outcome.executor_id))],
    gas,
    fee,
    event,
  };
}
