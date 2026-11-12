import {
  TypedDataEncoder,
  keccak256,
  toUtf8Bytes,
  getBytes,
  hexlify,
  verifyTypedData,
  computeAddress,
  Transaction,
  Signature,
} from "ethers";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";

export const TESTNET_RPC = "https://test.rpc.fastnear.com";
export const MPC_CONTRACT = "v1.signer-prod.testnet";
export const DERIVATION_PATH = "tong:sepolia:11155111";
export const FEES = Object.freeze({
  link: "1650000000000000000000000",
  set_note: "0",
  sign_sepolia: "10000000000000000000000",
});
export const TYPES = {
  TongRequest: [
    { name: "domain", type: "string" },
    { name: "wallet", type: "string" },
    { name: "action", type: "string" },
    { name: "data", type: "string" },
    { name: "nonce", type: "uint64" },
    { name: "deadline", type: "uint64" },
  ],
};
export const domainFor = (contractId) => `near:testnet:${contractId}`;
export const typedDomain = (domain) => ({
  name: "Tong",
  version: "1",
  salt: keccak256(toUtf8Bytes(domain)),
});
export const typedHash = (request) =>
  TypedDataEncoder.hash(typedDomain(request.domain), TYPES, request);
export const edMessage = (r) =>
  toUtf8Bytes(
    `Tong request v1\n${r.domain}\n${r.wallet}\n${r.action}\n${keccak256(toUtf8Bytes(r.data)).slice(2)}\n${r.nonce}\n${r.deadline}`,
  );
export const evmWallet = (address) => `evm:${address.toLowerCase()}`;
export const solanaWallet = (publicKey) =>
  `solana:${hexlify(publicKey).slice(2)}`;
export const explorer = (tx) => `https://testnet.nearblocks.io/txns/${tx}`;
export function validateRequest(
  r,
  contractId,
  now = Math.floor(Date.now() / 1000),
) {
  if (
    !r ||
    Object.keys(r).sort().join(",") !==
      "action,data,deadline,domain,nonce,wallet"
  )
    throw new Error("Invalid request fields");
  if (r.domain !== domainFor(contractId)) throw new Error("Wrong domain");
  if (!/^evm:0x[0-9a-f]{40}$|^solana:[0-9a-f]{64}$/.test(r.wallet))
    throw new Error("Invalid wallet");
  if (
    !["nonce", "deadline"].every(
      (k) =>
        typeof r[k] === "string" &&
        /^(0|[1-9][0-9]*)$/.test(r[k]) &&
        BigInt(r[k]) < 2n ** 64n,
    )
  )
    throw new Error("Invalid integer");
  if (
    BigInt(r.deadline) < BigInt(now) ||
    BigInt(r.deadline) > BigInt(now + 300)
  )
    throw new Error("Expired or excessive deadline");
  if (
    typeof r.data !== "string" ||
    new TextEncoder().encode(r.data).length > 1024
  )
    throw new Error("Data too large");
  if (!Object.hasOwn(FEES, r.action)) throw new Error("Disallowed action");
  const data = JSON.parse(r.data);
  const keys = Object.keys(data).sort().join(",");
  if (r.action === "link" && r.data !== "{}")
    throw new Error("Link data must be empty");
  if (
    r.action === "set_note" &&
    (keys !== "note" ||
      typeof data.note !== "string" ||
      new TextEncoder().encode(data.note).length > 256)
  )
    throw new Error("Invalid note");
  if (r.action === "sign_sepolia") {
    if (
      keys !== "gas_price_wei,nonce,to,value_wei" ||
      !/^0x[0-9a-fA-F]{40}$/.test(data.to)
    )
      throw new Error("Invalid transfer fields");
    for (const k of ["nonce", "value_wei", "gas_price_wei"])
      if (
        typeof data[k] !== "string" ||
        !/^(0|[1-9][0-9]*)$/.test(data[k]) ||
        BigInt(data[k]) >= 2n ** 64n
      )
        throw new Error("Invalid transfer integer");
    if (
      BigInt(data.value_wei) > 10n ** 15n ||
      BigInt(data.gas_price_wei) <= 0n ||
      BigInt(data.gas_price_wei) > 100n * 10n ** 9n
    )
      throw new Error("Transfer exceeds policy");
  }
  return r;
}
export function verifyAuthorization(request, signature) {
  try {
    if (request.wallet.startsWith("evm:"))
      return (
        evmWallet(
          verifyTypedData(
            typedDomain(request.domain),
            TYPES,
            request,
            signature,
          ),
        ) === request.wallet
      );
    return ed25519.verify(
      getBytes(signature.startsWith("0x") ? signature : `0x${signature}`),
      edMessage(request),
      getBytes(`0x${request.wallet.slice(7)}`),
    );
  } catch {
    return false;
  }
}
export async function rpc(method, params, rpcUrl = TESTNET_RPC) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "tong", method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error)
    throw new Error(
      body.error.data?.error_message ?? body.error.message ?? "NEAR RPC failed",
    );
  return body.result;
}
export async function view(
  contractId,
  method,
  args = {},
  rpcUrl = TESTNET_RPC,
) {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  const args_base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(bytes).toString("base64")
      : btoa(String.fromCharCode(...bytes));
  const r = await rpc(
    "query",
    {
      request_type: "call_function",
      finality: "final",
      account_id: contractId,
      method_name: method,
      args_base64,
    },
    rpcUrl,
  );
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result)));
}
export async function deriveSepoliaAddress(accountId, rpcUrl = TESTNET_RPC) {
  const key = await view(
    MPC_CONTRACT,
    "derived_public_key",
    { path: DERIVATION_PATH, predecessor: accountId, domain_id: 0 },
    rpcUrl,
  );
  const encoded =
    typeof key === "string" ? key : (key.Secp256k1 ?? key.secp256k1);
  if (typeof encoded !== "string" || !encoded.startsWith("secp256k1:"))
    throw new Error("Unsupported MPC public key response");
  const raw = bs58.decode(encoded.split(":")[1]);
  return computeAddress(hexlify(new Uint8Array([4, ...raw])));
}
export function unsignedSepolia(t) {
  return Transaction.from({
    type: 0,
    chainId: 11155111,
    nonce: Number(t.nonce),
    gasPrice: BigInt(t.gas_price_wei),
    gasLimit: 21000n,
    to: t.to,
    value: BigInt(t.value_wei),
    data: "0x",
  });
}
export function assembleSepolia(transfer, mpcSignature) {
  const s = mpcSignature.Secp256k1 ?? mpcSignature;
  const tx = unsignedSepolia(transfer);
  tx.signature = Signature.from({
    r: `0x${s.big_r.affine_point.slice(2, 66)}`,
    s: `0x${s.s.scalar}`,
    yParity: s.recovery_id,
  });
  return {
    rawTransaction: tx.serialized,
    hash: tx.hash,
    from: tx.from,
    unsignedHash: tx.unsignedHash,
  };
}
export class TongConnector {
  constructor({
    contractId,
    rpcUrl = TESTNET_RPC,
    relayerUrl = "",
    evmProvider,
    solanaProvider,
  } = {}) {
    if (!contractId) throw new Error("Tong needs a contractId");
    Object.assign(this, {
      contractId,
      rpcUrl,
      relayerUrl,
      evmProvider,
      solanaProvider,
    });
    this.wallet = null;
    this.identity = null;
  }
  async connect(kind = "evm") {
    if (kind === "evm") {
      const provider = this.evmProvider ?? globalThis.window?.ethereum;
      if (!provider) throw new Error("Install an EVM wallet, then reload.");
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      if (!accounts?.[0]) throw new Error("Wallet returned no account");
      this.provider = provider;
      this.wallet = evmWallet(accounts[0]);
    } else if (kind === "solana") {
      const provider =
        this.solanaProvider ??
        globalThis.window?.phantom?.solana ??
        globalThis.window?.solana;
      if (!provider?.signMessage)
        throw new Error(
          "Install a Solana wallet with message signing, then reload.",
        );
      const { publicKey } = await provider.connect();
      this.provider = provider;
      this.wallet = solanaWallet(
        new Uint8Array(
          publicKey.toBytes ? publicKey.toBytes() : publicKey.toBuffer(),
        ),
      );
    } else throw new Error("Choose EVM or Solana");
    await this.refresh();
    return { wallet: this.wallet, identity: this.identity };
  }
  async refresh() {
    if (this.wallet)
      this.identity = await view(
        this.contractId,
        "get_identity",
        { wallet: this.wallet },
        this.rpcUrl,
      );
    return this.identity;
  }
  async prepare(action, data = {}) {
    if (!this.wallet) throw new Error("Connect a wallet first");
    await this.refresh();
    return validateRequest(
      {
        domain: domainFor(this.contractId),
        wallet: this.wallet,
        action,
        data: JSON.stringify(data),
        nonce: this.identity?.nonce ?? "0",
        deadline: String(Math.floor(Date.now() / 1000) + 240),
      },
      this.contractId,
    );
  }
  async authorize(request) {
    if (request.wallet !== this.wallet) throw new Error("Wallet changed");
    let signature;
    if (this.wallet.startsWith("evm:")) {
      const typed = TypedDataEncoder.getPayload(
        typedDomain(request.domain),
        TYPES,
        request,
      );
      signature = await this.provider.request({
        method: "eth_signTypedData_v4",
        params: [this.wallet.slice(4), JSON.stringify(typed)],
      });
    } else {
      const result = await this.provider.signMessage(
        edMessage(request),
        "utf8",
      );
      signature = hexlify(result.signature ?? result);
    }
    if (!verifyAuthorization(request, signature))
      throw new Error(
        "Wallet returned an invalid signature; reconnect the selected account.",
      );
    return { request, signature };
  }
  async submit(authorization) {
    const response = await fetch(`${this.relayerUrl}/api/relay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authorization),
    });
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error ?? `Relayer HTTP ${response.status}`);
    await this.refresh();
    return body;
  }
  async execute(action, data = {}) {
    return this.submit(await this.authorize(await this.prepare(action, data)));
  }
  async link() {
    return this.execute("link");
  }
  async setNote(note) {
    return this.execute("set_note", { note });
  }
  async signSepolia(transfer) {
    return this.execute("sign_sepolia", transfer);
  }
  disconnect() {
    this.wallet = null;
    this.identity = null;
    this.provider = null;
  }
}
export async function dryQuote() {
  const tokensResponse = await fetch(
    "https://1click.chaindefuser.com/v0/tokens",
    { signal: AbortSignal.timeout(20000) },
  );
  if (!tokensResponse.ok)
    throw new Error(`1Click tokens HTTP ${tokensResponse.status}`);
  const tokens = await tokensResponse.json();
  const origin = tokens.find(
    (t) => t.symbol === "USDC" && t.blockchain === "eth",
  );
  const destination = tokens.find(
    (t) => t.symbol === "USDC" && t.blockchain === "near",
  );
  if (!origin || !destination) throw new Error("1Click USDC route unavailable");
  const request = {
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: origin.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: destination.assetId,
    amount: "10000000",
    recipient:
      "0000000000000000000000000000000000000000000000000000000000000001",
    recipientType: "DESTINATION_CHAIN",
    refundTo: "0x0000000000000000000000000000000000000001",
    refundType: "ORIGIN_CHAIN",
    deadline: new Date(Date.now() + 300000).toISOString(),
  };
  const response = await fetch("https://1click.chaindefuser.com/v0/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      `1Click ${response.status}: ${JSON.stringify(result).slice(0, 300)}`,
    );
  return {
    network: "mainnet",
    dry: true,
    route: "10 USDC · Ethereum → NEAR",
    request,
    result,
    at: new Date().toISOString(),
  };
}
