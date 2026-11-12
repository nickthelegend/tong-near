import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Transaction, formatEther } from "ethers";
import {
  rpc,
  deriveSepoliaAddress,
  unsignedSepolia,
} from "../packages/sdk/src/index.mjs";
import { newestChainSignature, sepoliaRpc } from "./lib/sepolia-evidence.mjs";

const config = JSON.parse(await readFile("deployments/testnet.json", "utf8"));
// Load by path; never log credentials. No NEAR write is made by this revalidation.
const credentialFile =
  process.env.TONG_RELAYER_KEY_FILE ?? ".near-credentials/relayer.json";
const credential = JSON.parse(await readFile(credentialFile, "utf8"));
assert.equal(
  credential.account_id,
  config.relayer_id,
  "Only Tong’s own relayer is allowed",
);
const relayerState = await rpc("query", {
  request_type: "view_account",
  finality: "final",
  account_id: credential.account_id,
});
const { file: source, evidence: saved } = await newestChainSignature();
assert.equal(BigInt(await sepoliaRpc("eth_chainId")), 11155111n);
const latest = await sepoliaRpc("eth_getBlockByNumber", ["latest", false]);
const baseFee = BigInt(latest.baseFeePerGas);
const targetPrice = baseFee * 2n;
const tx = Transaction.from(saved.rawTransaction);
const expected = "0x1b5e316144D8aFB875b4C8Ab751f83F463E4AFa8";
assert.equal(tx.from.toLowerCase(), expected.toLowerCase());
assert.equal(
  (await deriveSepoliaAddress(saved.predecessor)).toLowerCase(),
  expected.toLowerCase(),
);
assert.equal(tx.unsignedHash, unsignedSepolia(saved.transfer).unsignedHash);
assert.equal(tx.chainId, 11155111n);
const nonce = BigInt(
  await sepoliaRpc("eth_getTransactionCount", [expected, "pending"]),
);
const balance = BigInt(
  await sepoliaRpc("eth_getBalance", [expected, "latest"]),
);
assert.equal(
  nonce,
  BigInt(tx.nonce),
  "Saved nonce is stale; a fresh app authorization is needed",
);
if (targetPrice > 100_000_000_000n)
  throw new Error("Base fee × 2 exceeds the on-chain 100 gwei policy");
if (tx.gasPrice < targetPrice)
  throw new Error(
    "Saved transaction lacks 2× base-fee headroom: request one fresh sign_sepolia through the app before recording evidence",
  );
const at = new Date().toISOString();
const date = at.slice(0, 10);
const evidenceFile = `deployments/chain-signature-r3-${date}.json`;
const evidence = {
  ...saved,
  at,
  signature_at: saved.signature_at ?? saved.at,
  source_evidence: source,
  signature_reused: true,
  refresh_reason:
    "Saved price remains above both the current base fee and 2× base fee; no new MPC request was needed.",
  fee_check: {
    at,
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    block_number: latest.number,
    block_hash: latest.hash,
    base_fee_wei: String(baseFee),
    target_gas_price_wei: String(targetPrice),
    saved_gas_price_wei: String(tx.gasPrice),
    underpriced: false,
  },
  balance_wei: String(balance),
  required_gas_wei: String(tx.gasLimit * tx.gasPrice),
  required_eth: formatEther(tx.gasLimit * tx.gasPrice + tx.value),
  broadcast_status: "BLOCKED",
  broadcast_reason:
    "Sepolia test ETH funding and broadcast are Nick’s manual step. No ETH was sent or requested in R3.",
};
await writeFile(evidenceFile, JSON.stringify(evidence, null, 2) + "\n", {
  flag: "wx",
});
const ledger = {
  at,
  round: "R3",
  start_commit: "231db43",
  network: "testnet",
  account_id: credential.account_id,
  credential_source: "TONG_RELAYER_KEY_FILE path",
  budget_limit_yocto: "300000000000000000000000",
  cumulative_spend_yocto: "0",
  cumulative_spend_near: "0",
  transactions: [],
  balance_checks: [
    {
      at,
      account_id: credential.account_id,
      amount: relayerState.amount,
      storage_usage: relayerState.storage_usage,
      block_hash: relayerState.block_hash,
      block_height: relayerState.block_height,
      purpose: "Confirm own relayer; no write required",
    },
  ],
  evidence_file: evidenceFile,
  result:
    "Existing signature revalidated; conditional fresh-sign request not needed.",
};
await writeFile(
  `deployments/r3-${date}.json`,
  JSON.stringify(ledger, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify(
    {
      evidence_file: evidenceFile,
      signer: tx.from,
      base_fee_wei: String(baseFee),
      gas_price_wei: String(tx.gasPrice),
      required_eth: evidence.required_eth,
      near_spent: "0",
      fresh_mpc_requested: false,
    },
    null,
    2,
  ),
);
