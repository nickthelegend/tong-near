import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Account, KeyPair, KeyPairSigner, JsonRpcProvider } from "near-api-js";
import { Wallet, hexlify } from "ethers";
import { ed25519 } from "@noble/curves/ed25519";
import {
  TYPES,
  typedDomain,
  edMessage,
  evmWallet,
  solanaWallet,
  view,
  FEES,
} from "../packages/sdk/src/index.mjs";
import { decodeOutcome } from "../packages/relayer/src/core.mjs";
const url = process.env.TONG_SANDBOX_RPC;
const provider = new JsonRpcProvider({ url });
const k = JSON.parse(await readFile(process.env.TONG_SANDBOX_KEY_FILE, "utf8"));
const root = new Account(
  "test.near",
  provider,
  new KeyPairSigner(KeyPair.fromString(k.secret_key)),
);
const contract = "tong.test.near";
const key = KeyPair.fromRandom("ed25519");
const wallet = Wallet.createRandom(),
  wrong = Wallet.createRandom(),
  edKey = ed25519.utils.randomPrivateKey();
const evmId = evmWallet(wallet.address),
  edId = solanaWallet(ed25519.getPublicKey(edKey));
let passed = [];
async function run(label, fn) {
  await fn();
  passed.push(label);
}
const sign = async (r, signer = wallet) =>
  signer.signTypedData(typedDomain(r.domain), TYPES, r);
const req = (id, action, nonce, data = "{}", extra = {}) => ({
  domain: `near:testnet:${contract}`,
  wallet: id,
  action,
  data,
  nonce: String(nonce),
  deadline: String(Math.floor(Date.now() / 1000) + 240),
  ...extra,
});
async function call(r, signature, deposit = FEES[r.action] ?? "0") {
  try {
    return decodeOutcome(
      await root.callFunctionRaw({
        contractId: contract,
        methodName: "execute",
        args: { request: r, signature },
        gas: 280_000_000_000_000n,
        deposit: BigInt(deposit),
        waitUntil: "FINAL",
      }),
    );
  } catch (e) {
    return { ok: false, failure: e.message };
  }
}
async function reject(r, signature, pattern, deposit) {
  const out = await call(r, signature, deposit);
  assert.equal(out.ok, false);
  assert.match(JSON.stringify(out.failure), pattern);
}
test(
  "NEAR WASM sandbox: cryptographic authorization and account isolation",
  { timeout: 180000 },
  async () => {
    await root.createAccount({
      newAccountId: contract,
      publicKey: key.getPublicKey(),
      nearToTransfer: 10n * 10n ** 24n,
    });
    const factory = new Account(contract, provider, new KeyPairSigner(key));
    await factory.deployContract(
      await readFile("packages/contract/target/near/tong.wasm"),
    );
    await factory.callFunction({
      contractId: contract,
      methodName: "new",
      args: {},
      gas: 30_000_000_000_000n,
    });
    const app = "app.test.near";
    await root.createAccount({
      newAccountId: app,
      publicKey: key.getPublicKey(),
      nearToTransfer: 5n * 10n ** 24n,
    });
    const appAccount = new Account(app, provider, new KeyPairSigner(key));
    // A stand-in "app": the Tong account wasm, initialized with the app itself as controller.
    await appAccount.deployContract(await readFile("packages/contract/res/tong_account.wasm"));
    await appAccount.callFunction({ contractId: app, methodName: "new", args: { controller: app }, gas: 30_000_000_000_000n });
    await run("name availability and bad names checked on chain", async () => {
      assert.equal(await view(contract, "name_available", { name: "maya" }, url), true);
      await assert.rejects(() => view(contract, "name_available", { name: "Bad.Name" }, url), /lowercase/);
    });
    let r = req(evmId, "link", 0, '{"name":"maya"}'),
      sig = await sign(r);
    await run(
      "valid EVM EIP-712 signature creates keyless controlled account",
      async () => {
        const out = await call(r, sig);
        assert.equal(out.ok, true, JSON.stringify(out));
        const id = await view(contract, "get_identity", { wallet: evmId }, url);
        assert.equal(id.ready, true);
        assert.equal(id.account_id, `maya.${contract}`);
        assert.equal(await view(contract, "owner_of", { account_id: `maya.${contract}` }, url), evmId);
        assert.equal(id.policy.grants[0].contract, "wrap.testnet");
      },
    );
    await run("replay rejected on chain", () => reject(r, sig, /nonce|replay/));
    r = req(evmId, "set_note", 1, '{"note":"Connected through Tong"}');
    await run("wrong EVM signer rejected", async () =>
      reject(r, await sign(r, wrong), /wrong EVM signer/),
    );
    await run("expired request rejected", async () => {
      const x = { ...r, deadline: "1" };
      await reject(x, await sign(x), /expired/);
    });
    await run("wrong domain rejected", async () => {
      const x = { ...r, domain: "near:testnet:evil.testnet" };
      await reject(x, await sign(x), /wrong domain/);
    });
    await run("disallowed action rejected", async () => {
      const x = { ...r, action: "delete_account" };
      await reject(x, await sign(x), /disallowed action/, "0");
    });
    await run("tampered action data rejected", async () => {
      await reject(
        { ...r, data: '{"note":"changed"}' },
        await sign(r),
        /wrong EVM signer/,
      );
    });
    await run("valid signed NEAR note action executes on child", async () => {
      const out = await call(r, await sign(r));
      assert.equal(out.ok, true, JSON.stringify(out));
      const id = await view(contract, "get_identity", { wallet: evmId }, url);
      assert.equal(
        (await view(id.account_id, "get_state", {}, url)).note,
        "Connected through Tong",
      );
    });
    await run("child refuses direct relayer call", async () => {
      const id = await view(contract, "get_identity", { wallet: evmId }, url);
      await assert.rejects(
        () =>
          root.callFunction({
            contractId: id.account_id,
            methodName: "set_note",
            args: { note: "bypass" },
            gas: 30_000_000_000_000n,
          }),
        /controller only/,
      );
    });
    await run("a second wallet cannot take a used name", async () => {
      const other = Wallet.createRandom();
      const x = req(evmWallet(other.address), "link", 0, '{"name":"maya"}');
      await reject(x, await sign(x, other), /name taken/);
    });
    const state = async () => (await view(contract, "get_identity", { wallet: evmId }, url));
    const signed = async (action, data) => {
      const x = req(evmId, action, (await state()).nonce, JSON.stringify(data));
      return [x, await sign(x)];
    };
    await run("app call outside the allowlist refused on chain", async () => {
      const [x, s] = await signed("call", { contract: app, method: "get_state", args: "{}", deposit: "0" });
      await reject(x, s, /no permission for app.test.near/);
    });
    await run("method outside the grant refused on chain", async () => {
      const [x, s] = await signed("call", { contract: "wrap.testnet", method: "ft_transfer", args: "{}", deposit: "1" });
      await reject(x, s, /ft_transfer is not an allowed method/);
    });
    await run("deposit over the per-call cap refused on chain", async () => {
      const [x, s] = await signed("call", { contract: "wrap.testnet", method: "near_deposit", args: "{}", deposit: "500000000000000000000000" });
      await reject(x, s, /0.5 NEAR is over the 0.2 NEAR per-call limit/);
    });
    await run("signed grant adds an app permission", async () => {
      const [x, s] = await signed("grant", { contract: app, methods: ["get_state", "set_note"], max_deposit: "50000000000000000000000", days: 7 });
      const out = await call(x, s);
      assert.equal(out.ok, true, JSON.stringify(out));
      assert.ok((await state()).policy.grants.some((g) => g.contract === app));
    });
    await run("allowed app call executes from the named account", async () => {
      const [x, s] = await signed("call", { contract: app, method: "get_state", args: "{}", deposit: "0" });
      const out = await call(x, s);
      assert.equal(out.ok, true, JSON.stringify(out));
    });
    await run("failed downstream app call gives the deposit back to the daily allowance", async () => {
      const [x, s] = await signed("call", { contract: app, method: "set_note", args: '{"note":"x"}', deposit: "50000000000000000000000" });
      const out = await call(x, s);
      assert.equal(out.ok, false);
      assert.equal((await state()).policy.spent_today, "0");
    });
    await run("NEAR send within the cap executes; over the cap refused", async () => {
      let [x, s] = await signed("send_near", { to: "test.near", amount: "100000000000000000000000" });
      let out = await call(x, s);
      assert.equal(out.ok, true, JSON.stringify(out));
      [x, s] = await signed("send_near", { to: "test.near", amount: "150000000000000000000000" });
      await reject(x, s, /over the 0.1 NEAR per-transfer limit/);
    });
    await run("daily cap refused on chain", async () => {
      for (let i = 0; i < 2; i++) {
        const [x, s] = await signed("send_near", { to: "test.near", amount: "100000000000000000000000" });
        assert.equal((await call(x, s)).ok, true);
      }
      const [x, s] = await signed("send_near", { to: "test.near", amount: "10000000000000000000000" });
      await reject(x, s, /would pass today's 0.3 NEAR limit/);
    });
    await run("revoked app refused on chain", async () => {
      let [x, s] = await signed("revoke", { contract: app });
      assert.equal((await call(x, s)).ok, true);
      [x, s] = await signed("call", { contract: app, method: "get_state", args: "{}", deposit: "0" });
      await reject(x, s, /no permission/);
    });
    await run("a replayed signature is refused on chain", async () => {
      const [x, s] = await signed("set_note", { note: "once" });
      assert.equal((await call(x, s)).ok, true);
      await reject(x, s, /wrong nonce or replay/);
    });
    r = req(edId, "link", 0, '{"name":"sol-friend"}');
    sig = hexlify(ed25519.sign(edMessage(r), edKey));
    await run(
      "valid ed25519 signature creates distinct controlled account",
      async () => {
        const out = await call(r, sig);
        assert.equal(out.ok, true, JSON.stringify(out));
        const a = await view(contract, "get_identity", { wallet: evmId }, url),
          b = await view(contract, "get_identity", { wallet: edId }, url);
        assert.notEqual(a.account_id, b.account_id);
        const keys = await provider.query({
          request_type: "view_access_key_list",
          finality: "final",
          account_id: b.account_id,
        });
        assert.equal(keys.keys.length, 0);
      },
    );
    await run("wrong ed25519 signer rejected", async () => {
      const x = req(edId, "set_note", 1, '{"note":"hello"}');
      await reject(
        x,
        hexlify(ed25519.sign(edMessage(x), ed25519.utils.randomPrivateKey())),
        /wrong ed25519 signer/,
      );
    });
    await run("unbounded Sepolia value rejected on chain", async () => {
      const x = req(
        evmId,
        "sign_sepolia",
        (await state()).nonce,
        JSON.stringify({
          to: wallet.address,
          value_wei: "1000000000000001",
          nonce: "0",
          gas_price_wei: "1000000000",
        }),
      );
      await reject(x, await sign(x), /exceeds 0.001 ETH/);
    });
    await writeFile(
      "deployments/sandbox-tests.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          network: "local sandbox",
          passed: passed.length,
          checks: passed,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${passed.length} on-chain sandbox checks passed`);
  },
);
