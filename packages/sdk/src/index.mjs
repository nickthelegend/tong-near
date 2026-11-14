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
// Deposit the relayer attaches per action. App deposits and NEAR transfers come from the user's own
// NEAR account balance, never from the relayer, and are capped by the on-chain policy.
export const FEES = Object.freeze({
  link: "1900000000000000000000000",
  set_note: "0",
  call: "0",
  send_near: "0",
  grant: "0",
  revoke: "0",
  sign_sepolia: "10000000000000000000000",
});
export const NAME_RE = /^(?=.{2,32}$)[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
export const ACCOUNT_RE = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const YOCTO = 10n ** 24n;
export function parseNear(text) {
  const m = /^\s*(\d+)(?:\.(\d{0,24}))?\s*$/.exec(String(text));
  if (!m) throw new Error("Enter an amount like 0.1");
  return BigInt(m[1]) * YOCTO + BigInt((m[2] ?? "").padEnd(24, "0") || "0");
}
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
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Data must be a JSON object");
  const keys = Object.keys(data).sort().join(",");
  const uint = (v) => typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v);
  const yocto = (v) => uint(v) && BigInt(v) < 2n ** 128n;
  // Shape checks only. Spending limits (allowlist, caps, daily cap, expiry) are enforced by the
  // contract on chain, so a relayer cannot loosen or tighten them.
  if (r.action === "link" && (keys !== "name" || !NAME_RE.test(data.name)))
    throw new Error("Choose a name: 2-32 lowercase letters, digits, - or _");
  if (
    r.action === "set_note" &&
    (keys !== "note" ||
      typeof data.note !== "string" ||
      new TextEncoder().encode(data.note).length > 256)
  )
    throw new Error("Invalid note");
  if (r.action === "call") {
    if (
      keys !== "args,contract,deposit,method" ||
      !ACCOUNT_RE.test(data.contract) ||
      !/^[a-z0-9_]{1,64}$/.test(data.method) ||
      typeof data.args !== "string" ||
      data.args.length > 512 ||
      !yocto(data.deposit)
    )
      throw new Error("Invalid app call");
    JSON.parse(data.args);
  }
  if (
    r.action === "send_near" &&
    (keys !== "amount,to" || !ACCOUNT_RE.test(data.to) || !yocto(data.amount) || BigInt(data.amount) === 0n)
  )
    throw new Error("Invalid transfer");
  if (
    r.action === "grant" &&
    (keys !== "contract,days,max_deposit,methods" ||
      !ACCOUNT_RE.test(data.contract) ||
      !Array.isArray(data.methods) ||
      data.methods.length < 1 ||
      data.methods.length > 4 ||
      !data.methods.every((m) => /^[a-z0-9_]{1,64}$/.test(m)) ||
      !yocto(data.max_deposit) ||
      !Number.isInteger(data.days) ||
      data.days < 1 ||
      data.days > 30)
  )
    throw new Error("Invalid permission grant");
  if (r.action === "revoke" && (keys !== "contract" || !ACCOUNT_RE.test(data.contract)))
    throw new Error("Invalid revoke");
  if (r.action === "sign_sepolia") {
    if (
      keys !== "gas_price_wei,nonce,to,value_wei" ||
      !/^0x[0-9a-fA-F]{40}$/.test(data.to)
    )
      throw new Error("Invalid transfer fields");
    for (const k of ["nonce", "value_wei", "gas_price_wei"])
      if (!uint(data[k]) || BigInt(data[k]) >= 2n ** 64n)
        throw new Error("Invalid transfer integer");
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
  // Retrying a read is safe; never replay a broadcast after an ambiguous response.
  const readOnly = ["query", "gas_price", "status", "tx", "block"].includes(
    method,
  );
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "tong", method, params }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const retry =
        readOnly &&
        attempt < 3 &&
        [429, 502, 503, 504].includes(response.status);
      const header = response.headers.get("Retry-After");
      const seconds = header === null ? null : Number(header);
      const delay =
        header === null
          ? 500 * 2 ** attempt
          : Number.isFinite(seconds)
            ? seconds * 1000
            : Date.parse(header) - Date.now();
      // Respect longer server backoffs by failing instead of retrying too early.
      if (retry && Number.isFinite(delay) && delay <= 10000) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
        continue;
      }
      throw new Error(`NEAR RPC HTTP ${response.status}`);
    }
    const body = await response.json();
    if (body.error)
      throw new Error(
        body.error.data?.error_message ??
          body.error.message ??
          "NEAR RPC failed",
      );
    return body.result;
  }
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
  if (r.error) throw new Error(r.error);
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
    if (body.ok === false)
      // The transaction landed on NEAR and the contract refused it (policy, nonce, signature...).
      throw Object.assign(new Error(body.reason ?? "Refused on chain"), {
        refused: true,
        txHash: body.txHash,
        explorer: body.explorer,
      });
    return body;
  }
  async execute(action, data = {}) {
    return this.submit(await this.authorize(await this.prepare(action, data)));
  }
  /** Creates `<name>.<factory>`: a named NEAR account with zero keys, owned by this wallet's signature. */
  async link(name) {
    return this.execute("link", { name });
  }
  async nameAvailable(name) {
    return view(this.contractId, "name_available", { name }, this.rpcUrl);
  }
  /** Calls any NEAR app the account's policy allows. `deposit` (yoctoNEAR) comes from the account's own balance. */
  async call(contract, method, args = {}, deposit = "0") {
    return this.execute("call", { contract, method, args: JSON.stringify(args), deposit: String(deposit) });
  }
  async sendNear(to, amount) {
    return this.execute("send_near", { to, amount: String(amount) });
  }
  /** Asks the wallet to allow `methods` on `contract`, at most `maxDeposit` yoctoNEAR per call, for `days`. */
  async grant(contract, methods, maxDeposit = "0", days = 7) {
    return this.execute("grant", { contract, methods, max_deposit: String(maxDeposit), days });
  }
  async revoke(contract) {
    return this.execute("revoke", { contract });
  }
  get policy() {
    return this.identity?.policy ?? null;
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
