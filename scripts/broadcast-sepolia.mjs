import { Transaction } from "ethers";
import { load, save } from "./common.mjs";
import {
  deriveSepoliaAddress,
  unsignedSepolia,
} from "../packages/sdk/src/index.mjs";
const evidence = await load("deployments/chain-signature.json");
const rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com";
async function rpc(method, params = []) {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Sepolia RPC HTTP ${r.status}`);
  const body = await r.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}
if (BigInt(await rpc("eth_chainId")) !== 11155111n)
  throw new Error("Refusing non-Sepolia RPC");
const tx = Transaction.from(evidence.rawTransaction);
const derived = await deriveSepoliaAddress(evidence.predecessor);
if (
  tx.chainId !== 11155111n ||
  tx.from.toLowerCase() !== derived.toLowerCase() ||
  tx.unsignedHash !== unsignedSepolia(evidence.transfer).unsignedHash
)
  throw new Error(
    "Saved transaction does not match its derived address or approved fields",
  );
if (
  evidence.broadcast_status === "BROADCAST" ||
  evidence.broadcast_status === "CONFIRMED"
) {
  console.log(
    `Already ${evidence.broadcast_status}: ${evidence.sepolia_tx_hash}`,
  );
  process.exit(0);
}
const balance = BigInt(await rpc("eth_getBalance", [derived, "latest"]));
const nonce = BigInt(
  await rpc("eth_getTransactionCount", [derived, "pending"]),
);
const required = tx.gasLimit * tx.gasPrice + tx.value;
const attempt = {
  at: new Date().toISOString(),
  chain_id: 11155111,
  derived_address: derived,
  balance_wei: String(balance),
  required_wei: String(required),
  nonce: String(nonce),
  status: "BLOCKED",
};
if (nonce !== BigInt(tx.nonce))
  attempt.reason = "Saved nonce is stale; request a fresh user authorization.";
else if (balance < required)
  attempt.reason =
    "Insufficient Sepolia test ETH for the saved signed transaction.";
else {
  const hash = await rpc("eth_sendRawTransaction", [evidence.rawTransaction]);
  attempt.status = "BROADCAST";
  attempt.tx_hash = hash;
  // Persist the hash before waiting so interruption cannot lose a broadcast.
  await save("deployments/chain-signature.json", {
    ...evidence,
    broadcast_status: "BROADCAST",
    broadcast_reason: null,
    sepolia_tx_hash: hash,
    sepolia_explorer: `https://sepolia.etherscan.io/tx/${hash}`,
  });
  await save("deployments/broadcast-attempt.json", attempt);
  for (let i = 0; i < 12; i++) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      attempt.receipt = receipt;
      attempt.status = receipt.status === "0x1" ? "CONFIRMED" : "FAILED";
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  await save("deployments/chain-signature.json", {
    ...(await load("deployments/chain-signature.json")),
    broadcast_status: attempt.status,
    sepolia_receipt: attempt.receipt ?? null,
  });
}
await save("deployments/broadcast-attempt.json", attempt);
console.log(`${attempt.status}: ${attempt.reason ?? attempt.tx_hash}`);
