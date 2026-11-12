import { KeyPair } from "near-api-js";
import { readFile } from "node:fs/promises";
import { credentials, signer, load, save, record, sha } from "./common.mjs";
import { view, rpc } from "../packages/sdk/src/index.mjs";
const c = await credentials(
  "factory",
  `tong-${Date.now().toString(36).slice(-6)}.testnet`,
);
const account = await signer("factory");
let state;
try {
  state = await account.getState();
} catch (error) {
  if (!/does not exist|UNKNOWN_ACCOUNT/i.test(error.message)) throw error;
  const response = await fetch("https://helper.nearprotocol.com/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      newAccountId: c.account_id,
      newAccountPublicKey: KeyPair.fromString(c.secret_key)
        .getPublicKey()
        .toString(),
    }),
    signal: AbortSignal.timeout(60000),
  });
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { body: responseText.slice(0, 1000) };
  }
  await save("deployments/faucet.json", {
    at: new Date().toISOString(),
    status: response.status,
    account_id: c.account_id,
    result,
  });
  if (!response.ok)
    throw new Error(
      `NEAR faucet HTTP ${response.status}; see deployments/faucet.json`,
    );
  state = await account.getState();
}
console.log(
  `Factory ${c.account_id}; balance ${state.balance ?? state.amount ?? "RPC-reported"} yoctoNEAR`,
);
const relayer = await credentials("relayer", `relay.${c.account_id}`);
const sponsor = await signer("relayer");
try {
  await sponsor.getState();
} catch (error) {
  if (!/does not exist|UNKNOWN_ACCOUNT/i.test(error.message)) throw error;
  await record("create funded relayer", () =>
    account.createAccount({
      newAccountId: relayer.account_id,
      publicKey: KeyPair.fromString(relayer.secret_key).getPublicKey(),
      nearToTransfer: 5n * 10n ** 24n,
    }),
  );
}
const wasm = await readFile("packages/contract/target/near/tong.wasm");
let initialized = false;
try {
  await view(c.account_id, "get_config");
  initialized = true;
} catch {}
if (!initialized) {
  await record("deploy Tong factory", () => account.deployContract(wasm));
  await record("initialize Tong factory", () =>
    account.callFunctionRaw({
      contractId: c.account_id,
      methodName: "new",
      args: {},
      gas: 30_000_000_000_000n,
      deposit: 0n,
      waitUntil: "FINAL",
    }),
  );
}
const previous = await load("deployments/testnet.json").catch(() => null);
if (
  initialized &&
  previous?.contract_id === c.account_id &&
  previous.contract_sha256 !== sha(wasm)
)
  throw new Error(
    "Initialized deployment has a different WASM hash; use a fresh account/domain.",
  );
const accessKeys = await rpc("query", {
  request_type: "view_access_key_list",
  finality: "final",
  account_id: c.account_id,
});
await save("deployments/testnet.json", {
  network: "testnet",
  contract_id: c.account_id,
  relayer_id: relayer.account_id,
  contract_sha256: sha(wasm),
  account_contract_sha256: sha(
    await readFile("packages/contract/res/tong_account.wasm"),
  ),
  deployed_at:
    previous?.contract_id === c.account_id
      ? previous.deployed_at
      : new Date().toISOString(),
  locked: accessKeys.keys.length === 0,
  mpc_contract: "v1.signer-prod.testnet",
  derivation_path: "tong:sepolia:11155111",
});
console.log(
  `Deployment initialized: ${c.account_id}. Run demo:testnet, then scripts/lock-testnet.mjs.`,
);
