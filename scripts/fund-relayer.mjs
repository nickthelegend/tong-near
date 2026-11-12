import { KeyPair } from "near-api-js";
import { credentials, signer, load, save, record } from "./common.mjs";
const config = await load("deployments/testnet.json");
const prior = await load("deployments/relayer-topup.json").catch(() => null);
if (prior?.ok) {
  console.log("Relayer testnet gas reserve already funded");
  process.exit(0);
}
const c = await credentials(
  "gas-reserve",
  `tong-gas-${Date.now().toString(36).slice(-6)}.testnet`,
);
const account = await signer("gas-reserve");
try {
  await account.getState();
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
  const result = await response.json();
  await save("deployments/gas-faucet.json", {
    at: new Date().toISOString(),
    status: response.status,
    account_id: c.account_id,
    result,
  });
  if (!response.ok) throw new Error(`Gas faucet HTTP ${response.status}`);
}
const outcome = await record("fund relayer testnet gas reserve", () =>
  account.transfer({ receiverId: config.relayer_id, amount: 8n * 10n ** 24n }),
);
await save("deployments/relayer-topup.json", {
  at: new Date().toISOString(),
  ok: true,
  source: c.account_id,
  relayer: config.relayer_id,
  amount_yocto: "8000000000000000000000000",
  txHash: outcome.txHash,
});
