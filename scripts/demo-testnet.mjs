import { Wallet, hexlify } from "ethers";
import { ed25519 } from "@noble/curves/ed25519";
import { readFile, writeFile } from "node:fs/promises";
import { load, save, signer, record } from "./common.mjs";
import {
  FEES,
  TYPES,
  typedDomain,
  domainFor,
  edMessage,
  evmWallet,
  solanaWallet,
  view,
  deriveSepoliaAddress,
  assembleSepolia,
  unsignedSepolia,
  dryQuote,
} from "../packages/sdk/src/index.mjs";
const config = await load("deployments/testnet.json"),
  contractId = config.contract_id;
const relayer = await signer("relayer");
let keys = await load(".near-credentials/demo-wallets.json").catch((e) => {
  if (e.code === "ENOENT") return null;
  throw e;
});
if (!keys) {
  const evm = Wallet.createRandom();
  keys = {
    evm: evm.privateKey,
    ed25519: hexlify(ed25519.utils.randomPrivateKey()),
  };
  await writeFile(".near-credentials/demo-wallets.json", JSON.stringify(keys), {
    mode: 0o600,
  });
}
const evm = new Wallet(keys.evm),
  edKey = Buffer.from(keys.ed25519.slice(2), "hex");
const ids = {
  evm: evmWallet(evm.address),
  solana: solanaWallet(ed25519.getPublicKey(edKey)),
};
async function execute(kind, action, data = {}) {
  const wallet = ids[kind];
  const identity = await view(contractId, "get_identity", { wallet });
  const request = {
    domain: domainFor(contractId),
    wallet,
    action,
    data: JSON.stringify(data),
    nonce: identity?.nonce ?? "0",
    deadline: String(Math.floor(Date.now() / 1000) + 240),
  };
  const signature =
    kind === "evm"
      ? await evm.signTypedData(typedDomain(request.domain), TYPES, request)
      : hexlify(ed25519.sign(edMessage(request), edKey));
  return record(`${kind}: ${action}`, () =>
    relayer.callFunctionRaw({
      contractId,
      methodName: "execute",
      args: { request, signature },
      gas: 280_000_000_000_000n,
      deposit: BigInt(FEES[action]),
      waitUntil: "FINAL",
    }),
  );
}
const identities = {};
for (const kind of ["evm", "solana"]) {
  if (!(await view(contractId, "get_identity", { wallet: ids[kind] })))
    await execute(kind, "link");
  identities[kind] = await view(contractId, "get_identity", {
    wallet: ids[kind],
  });
  if (!identities[kind].ready)
    throw new Error(`Child ${kind} did not initialize`);
  const child = await view(identities[kind].account_id, "get_state");
  if (!child.note)
    await execute(kind, "set_note", {
      note:
        kind === "evm"
          ? "Connected from an EVM wallet through Tong."
          : "Connected from a Solana ed25519 wallet through Tong.",
    });
  identities[kind] = await view(contractId, "get_identity", {
    wallet: ids[kind],
  });
}
await save("deployments/demo-identities.json", {
  at: new Date().toISOString(),
  wallets: ids,
  identities,
});
const accountId = identities.evm.account_id;
const address = await deriveSepoliaAddress(accountId);
console.log(`Child ${accountId}; derived Sepolia address ${address}`);
const evmRpc = "https://ethereum-sepolia-rpc.publicnode.com";
async function rpc(method, params = []) {
  const response = await fetch(evmRpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}
if (BigInt(await rpc("eth_chainId")) !== 11155111n)
  throw new Error("Sepolia only");
const transfer = {
  to: address,
  value_wei: "0",
  nonce: String(
    BigInt(await rpc("eth_getTransactionCount", [address, "pending"])),
  ),
  gas_price_wei: String(BigInt(await rpc("eth_gasPrice"))),
};
if (BigInt(transfer.gas_price_wei) > 100_000_000_000n)
  throw new Error("Sepolia gas exceeds policy");
const outcome = await execute("evm", "sign_sepolia", transfer);
const assembled = assembleSepolia(transfer, outcome.result);
if (assembled.from.toLowerCase() !== address.toLowerCase())
  throw new Error("MPC signature recovered wrong address");
if (assembled.unsignedHash !== unsignedSepolia(transfer).unsignedHash)
  throw new Error("MPC signed wrong transaction");
const balance = BigInt(await rpc("eth_getBalance", [address, "latest"]));
const requiredGas = BigInt(transfer.gas_price_wei) * 21000n;
const evidence = {
  at: new Date().toISOString(),
  network: "testnet",
  chain_id: 11155111,
  mpc_contract: config.mpc_contract,
  predecessor: accountId,
  path: config.derivation_path,
  derived_address: address,
  near_tx_hash: outcome.txHash,
  near_explorer: outcome.explorer,
  transfer,
  signature: outcome.result,
  ...assembled,
  balance_wei: String(balance),
  required_gas_wei: String(requiredGas),
  broadcast_status: "BLOCKED",
  broadcast_reason:
    "Derived Sepolia address has no test ETH for gas. Signed transaction is real and recovered to the derived address.",
};
if (balance >= requiredGas) {
  evidence.sepolia_tx_hash = await rpc("eth_sendRawTransaction", [
    assembled.rawTransaction,
  ]);
  evidence.broadcast_status = "BROADCAST";
  evidence.broadcast_reason = null;
}
await save("deployments/chain-signature.json", evidence);
console.log(`Chain Signature verified; Sepolia ${evidence.broadcast_status}`);
try {
  await save("deployments/oneclick-dry-quote.json", await dryQuote());
  console.log("1Click live mainnet dry quote recorded");
} catch (error) {
  await save("deployments/oneclick-dry-quote.json", {
    at: new Date().toISOString(),
    dry: true,
    status: "BLOCKED",
    error: error.message,
  });
  console.log("1Click quote blocked; reason recorded");
}
