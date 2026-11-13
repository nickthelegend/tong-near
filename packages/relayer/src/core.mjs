import {
  readFile,
  writeFile,
  rename,
  mkdir,
  open,
  unlink,
} from "node:fs/promises";
import { dirname } from "node:path";
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
    failure: failure ?? (result?.ok === false ? result.error : null),
  };
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
  const identity = await view(
    contractId,
    "get_identity",
    { wallet: request.wallet },
    rpcUrl,
  );
  if (request.nonce !== (identity?.nonce ?? "0"))
    throw new Error("Wrong nonce or replay");
  if (request.action === "link" ? identity !== null : !identity?.ready)
    throw new Error(
      request.action === "link" ? "Already linked" : "Link the wallet first",
    );
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
  let outcome;
  try {
    outcome = await account.callFunctionRaw({
      contractId,
      methodName: "execute",
      args: { request, signature },
      gas: GAS,
      deposit: BigInt(FEES[request.action]),
      waitUntil: "FINAL",
    });
  } catch (error) {
    if (error.transaction_outcome) outcome = error;
    else {
      await record({
        at: new Date().toISOString(),
        action: request.action,
        wallet: request.wallet,
        error: String(error.message).slice(0, 600),
        txHash: error.context?.transactionHash ?? null,
        ok: false,
      });
      throw new Error(
        "Transaction did not return final success; inspect relayer ledger before retrying.",
      );
    }
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
    throw new Error(
      `Transaction failed: ${result.txHash}. ${JSON.stringify(result.failure).slice(0, 240)}`,
    );
  return result;
}
