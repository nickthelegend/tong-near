import { readFile, readdir, writeFile } from "node:fs/promises";
import { Transaction, formatEther } from "ethers";
import {
  deriveSepoliaAddress,
  unsignedSepolia,
} from "../packages/sdk/src/index.mjs";
import {
  newestChainSignature,
  sepoliaRpc as rpc,
} from "./lib/sepolia-evidence.mjs";

// Select by evidence timestamp, never by a hard-coded original filename.
const { file: evidenceFile, evidence } = await newestChainSignature();
const checkOnly = process.argv.includes("--check-only");
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

// Submission/receipt records are append-only, too. Never edit a signed evidence file.
for (const file of await readdir("deployments")) {
  if (!/^sepolia-broadcast-.*\.json$/.test(file)) continue;
  const prior = JSON.parse(await readFile(`deployments/${file}`, "utf8"));
  if (
    prior.tx_hash === tx.hash &&
    ["BROADCAST", "CONFIRMED", "FAILED"].includes(prior.status)
  ) {
    console.log(`Already ${prior.status}: ${prior.tx_hash} (${file})`);
    process.exit(0);
  }
}
const block = await rpc("eth_getBlockByNumber", ["latest", false]);
const baseFee = BigInt(block.baseFeePerGas);
const balance = BigInt(await rpc("eth_getBalance", [derived, "latest"]));
const nonce = BigInt(
  await rpc("eth_getTransactionCount", [derived, "pending"]),
);
const required = tx.gasLimit * tx.gasPrice + tx.value;
const at = new Date().toISOString();
const attempt = {
  at,
  chain_id: 11155111,
  signed_evidence_file: evidenceFile,
  derived_address: derived,
  tx_hash: tx.hash,
  balance_wei: String(balance),
  required_wei: String(required),
  required_eth: formatEther(required),
  nonce: String(nonce),
  base_fee_wei: String(baseFee),
  gas_price_wei: String(tx.gasPrice),
  check_only: checkOnly,
  status: "BLOCKED",
};
const prefix = `deployments/sepolia-broadcast-${at.replace(/[^0-9TZ]/g, "")}-${tx.hash.slice(2, 12)}`;
async function append(stage, data) {
  await writeFile(
    `${prefix}-${stage}.json`,
    JSON.stringify(data, null, 2) + "\n",
    { flag: "wx" },
  );
}
if (nonce !== BigInt(tx.nonce))
  attempt.reason =
    "Saved nonce is stale; request a fresh user authorization through the app.";
else if (tx.gasPrice < baseFee)
  attempt.reason =
    "Saved gas price is below the current base fee; request a fresh app signature at 2× base fee (≤100 gwei).";
else if (balance < required)
  attempt.reason =
    "Insufficient Sepolia test ETH for the selected signed transaction. Funding is Nick’s manual step.";
else if (checkOnly) {
  attempt.status = "READY";
  attempt.reason =
    "Funding and fee checks pass; --check-only sends no transaction.";
} else {
  await append("intent", attempt);
  const hash = await rpc("eth_sendRawTransaction", [evidence.rawTransaction]);
  if (hash.toLowerCase() !== tx.hash.toLowerCase())
    throw new Error(
      "RPC returned an unexpected transaction hash; inspect the saved intent before retrying",
    );
  attempt.status = "BROADCAST";
  attempt.tx_hash = hash;
  await append("submitted", attempt);
  for (let i = 0; i < 12; i++) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      attempt.receipt = receipt;
      attempt.status = receipt.status === "0x1" ? "CONFIRMED" : "FAILED";
      await append("receipt", attempt);
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
if (attempt.status === "BLOCKED" || checkOnly) await append("check", attempt);
console.log(
  JSON.stringify(
    {
      status: attempt.status,
      evidence: evidenceFile,
      reason: attempt.reason ?? null,
      tx_hash: attempt.tx_hash,
      required_eth: attempt.required_eth,
    },
    null,
    2,
  ),
);
