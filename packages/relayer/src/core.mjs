import {
  readFile,
  writeFile,
  rename,
  mkdir,
  open,
  unlink,
} from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { actions, encodeTransaction, baseEncode } from "near-api-js";
import {
  FEES,
  validateRequest,
  verifyAuthorization,
  view,
  explorer,
  rpc,
} from "@tong/sdk";
export const GAS = 280_000_000_000_000n;
export class Budget {
  constructor(file, { maxCost = 4n * 10n ** 24n, maxCalls = 40 } = {}) {
    Object.assign(this, { file, maxCost, maxCalls });
  }
  async status() {
    const day = new Date().toISOString().slice(0, 10);
    let state;
    try {
      state = JSON.parse(await readFile(this.file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw new Error("Budget ledger unreadable");
    }
    if (!state || state.day !== day) state = { day, calls: 0, reserved: "0" };
    return {
      day,
      calls: state.calls,
      maxCalls: this.maxCalls,
      reserved: state.reserved,
      maxReserved: String(this.maxCost),
    };
  }
  async reserve(deposit) {
    await mkdir(dirname(this.file), { recursive: true });
    let lock;
    try {
      lock = await open(`${this.file}.lock`, "wx", 0o600);
    } catch {
      throw new Error("Budget ledger busy or locked; refusing to spend");
    }
    try {
      const day = new Date().toISOString().slice(0, 10);
      let state;
      try {
        state = JSON.parse(await readFile(this.file, "utf8"));
      } catch (e) {
        if (e.code !== "ENOENT")
          throw new Error("Budget ledger unreadable; refusing to spend");
      }
      if (!state || state.day !== day) state = { day, calls: 0, reserved: "0" };
      // 0.1 NEAR gas reserve covers 280 Tgas at the enforced gas-price ceiling.
      // Reservations survive failed transactions.
      const cost = BigInt(deposit) + 10n ** 23n;
      if (
        state.calls >= this.maxCalls ||
        BigInt(state.reserved) + cost > this.maxCost
      )
        throw new Error("Daily sponsorship budget exhausted");
      state.calls++;
      state.reserved = String(BigInt(state.reserved) + cost);
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify(state), {
        mode: 0o600,
      });
      await rename(`${this.file}.tmp`, this.file);
      return state;
    } finally {
      await lock.close();
      await unlink(`${this.file}.lock`);
    }
  }
}
export function decodeOutcome(outcome) {
  const txHash = outcome.transaction?.hash ?? outcome.transaction_outcome?.id;
  const failure =
    outcome.status?.Failure ??
    outcome.receipts_outcome?.find((r) => r.outcome.status.Failure)?.outcome
      .status.Failure;
  let result = null;
  if (outcome.status?.SuccessValue) {
    const text = Buffer.from(outcome.status.SuccessValue, "base64").toString();
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
  }
  return {
    txHash,
    explorer: explorer(txHash),
    ok: !failure && result?.ok !== false,
    result,
    failure: failure ?? (result?.ok === false ? result.error ?? "downstream call failed" : null),
  };
}
/** Plain-language reason from a NEAR failure ("Smart contract panicked: policy: ..."). */
export function refusalReason(failure) {
  const text = typeof failure === "string" ? failure : JSON.stringify(failure ?? "");
  const m = /panicked: ([^"\\]+)/.exec(text);
  if (m) return m[1].trim();
  if (/LackBalanceForState|NotEnoughBalance/.test(text)) return "Your NEAR account does not hold enough NEAR for that";
  return text.slice(0, 200) || "Refused on chain";
}
export async function relay({
  authorization,
  contractId,
  account,
  rpcUrl,
  budget,
  record,
}) {
  const { request, signature } = authorization ?? {};
  validateRequest(request, contractId);
  if (
    typeof signature !== "string" ||
    signature.length > 132 ||
    !verifyAuthorization(request, signature)
  )
    throw new Error("Invalid wallet signature");
  // No policy, nonce or replay pre-checks here on purpose: the locked contract is the only judge.
  // A refused request still lands on chain (and spends sponsored gas, counted in the budget).
  const gasPrice = BigInt((await rpc("gas_price", [null], rpcUrl)).gas_price);
  if (gasPrice > 150_000_000n)
    throw new Error("Network gas price exceeds sponsorship policy");
  const funding = await rpc(
    "query",
    {
      request_type: "view_account",
      account_id: account.accountId,
      finality: "final",
    },
    rpcUrl,
  );
  const spendable =
    BigInt(funding.amount) - BigInt(funding.storage_usage) * 10n ** 19n;
  if (spendable < BigInt(FEES[request.action]) + 10n ** 23n)
    throw new Error(
      "Testnet sponsor needs more NEAR; ask the operator to fund the relayer.",
    );
  await budget.reserve(FEES[request.action]);
  // Sign locally so the hash is known before broadcast: a refused request keeps its explorer link.
  const signed = await account.createSignedTransaction({
    receiverId: contractId,
    actions: [actions.functionCall("execute", { request, signature }, GAS, BigInt(FEES[request.action]))],
  });
  const txHash = baseEncode(createHash("sha256").update(encodeTransaction(signed.transaction)).digest());
  let outcome;
  try {
    outcome = await rpc(
      "send_tx",
      { signed_tx_base64: Buffer.from(signed.encode()).toString("base64"), wait_until: "FINAL" },
      rpcUrl,
    );
  } catch (error) {
    await record({
      at: new Date().toISOString(),
      action: request.action,
      wallet: request.wallet,
      error: String(error.message).slice(0, 600),
      txHash,
      ok: false,
    });
    throw new Error(
      `Transaction ${txHash} did not return final status (${String(error.message).slice(0, 120)}); check the explorer before retrying.`,
    );
  }
  const result = decodeOutcome(outcome);
  await record({
    at: new Date().toISOString(),
    action: request.action,
    wallet: request.wallet,
    ...result,
    outcome,
  });
  if (!result.ok)
    return {
      ok: false,
      refused: true,
      txHash: result.txHash,
      explorer: result.explorer,
      reason: refusalReason(result.failure),
    };
  return result;
}
