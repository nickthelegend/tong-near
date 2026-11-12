# Tong 通

**Any wallet, any chain, one NEAR account.**

Tong lets an EVM or Solana wallet authorize a small set of NEAR actions without creating a NEAR key. A Rust factory verifies the foreign signature on chain, creates a deterministic keyless subaccount, and forwards only approved actions. That child can request a real NEAR Chain Signature for a bounded Sepolia transfer.

Built from scratch during NEAR HACKATHON, November 2026. Testnet only. MIT © 2026 Nivesh Gajengi. This is a prototype, not audited wallet infrastructure.

## What works today

- EVM **EIP-712** signatures verified with NEAR `env::ecrecover`.
- Solana **ed25519** message signatures verified with `env::ed25519_verify`.
- Deterministic, separately deployed child accounts with **zero access keys**. The factory is also locked and has no upgrade method.
- Signed NEAR note actions, strict nonces, five-minute maximum expiry, factory-specific domain separation and exact action schemas.
- **Real MPC signature** returned by `v1.signer-prod.testnet`, assembled into a Sepolia transaction and checked against the derived address.
- Vanilla connector, React hook, stdio MCP tools, a budgeted local relayer, and a responsive demo with integration docs.
- Live 1Click **mainnet dry quote**. No deposit address is requested and no mainnet transaction is signed.

The outbound transfer has **not been broadcast**: the newly derived Sepolia address has zero test ETH. A verified signed transaction is saved; see [BLOCKED.md](BLOCKED.md). “Any wallet, any chain” describes the product goal. This implementation supports injected EVM and Solana message signers, NEAR testnet, and outbound Sepolia native transfers. It does not yet implement WalletConnect mobile transport, arbitrary dApp function calls, wallet recovery or a production funding bridge.

## Inspect the live proof

Factory: [`tong-d8l0q0.testnet`](https://testnet.nearblocks.io/address/tong-d8l0q0.testnet).

| Evidence | Result |
| --- | --- |
| [EVM wallet linked](https://testnet.nearblocks.io/txns/cuGwhcFicW6tbBVdF1ytb5NzS2HWGwbnkMY6asMPteG) | Foreign signature created a keyless NEAR account |
| [ed25519 wallet linked](https://testnet.nearblocks.io/txns/DwQhSgSoNqKCLAJcx1r4qujcXV4mGwjXexTr5ktXWTq5) | Independent keyless NEAR account |
| [Signed NEAR note](https://testnet.nearblocks.io/txns/CDGpm3zuKjQMLHf5Lhg4n1shVVFJJtQpwU6c9qtsZiVh) | Note stored in the EVM user's child account |
| [Chain Signatures request](https://testnet.nearblocks.io/txns/2s9kMWVT6UGVSn625LuMGgnTYPzd5e3ikRXZ9trxNUZy) | Real MPC response, recovered and serialized |
| [Factory lock](https://testnet.nearblocks.io/txns/Am2uporPxoMYBo2V3NHvQSm3HxUtYXPRofeLDpv3f4H7) | Final full-access key deleted |

Full outcomes, including faucet funding and account creation, are in [deployments/transactions.json](deployments/transactions.json) and [deployments/faucet.json](deployments/faucet.json). [lock-proof.json](deployments/lock-proof.json) records empty access-key lists and the deployed code hash. [chain-signature.json](deployments/chain-signature.json) includes the MPC response, signing payload, raw signed transaction, recovered signer and gas funding requirement. [oneclick-dry-quote.json](deployments/oneclick-dry-quote.json) is a timestamped quote, not a current price or transfer receipt.

## Run it

Prerequisites: Node 22+, pnpm 10.29.2. Rust 1.95.0 and cargo-near 0.22.0 are required only to rebuild the contracts; the pinned toolchain installs the WASM target. The sandbox test script downloads near-sandbox 2.14.0-rc.4 for macOS arm64 or Linux.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build:contract
pnpm test:sandbox
pnpm build
pnpm dev
```

Open `http://127.0.0.1:5370`. The documentation and recorded proof work without a relayer. Click **Connect with Tong** to select an injected EVM or Solana wallet. Missing extensions produce an error with installation guidance.

To sponsor transactions, put a funded **testnet** relayer credential in a local, gitignored file with mode 0600. Its shape is `{ "account_id": "your-account.testnet", "secret_key": "<your own testnet secret>" }`. Set `TONG_RELAYER_KEY_FILE` to its path and run `pnpm relayer` in a second terminal. The relayer binds to `127.0.0.1:5371`; Vite proxies `/api`. No credentials are bundled or committed. The original local build already has its own gitignored credential file. Node loads an optional root `.env`; `.env.example` contains only public configuration and file paths.

Try it:

1. Connect a wallet, then **Sign & create account**. Expect a ready NEAR child and an explorer link after final execution.
2. Type a note and select the arrow to **sign and save**. Expect the saved note read back from the live child and a NEAR receipt.
3. Select **Sign a Sepolia test transaction**. Expect an MPC signature and a raw EIP-155 transaction for a zero-value self transfer. Signing alone does not broadcast it.
4. Select **Get dry quote**. Expect a live 10 USDC Ethereum → NEAR quote clearly labeled mainnet and dry.

**Use a temporary test wallet** generates a fresh EVM key in browser memory. It is explicitly a test wallet, disappears on reload and does not connect an existing wallet. Its link still needs a real signature and spends sponsored testnet funds. Do not send assets to that temporary identity.

The original demo was topped up with a separately recorded 8 test NEAR gas reserve (`node scripts/fund-relayer.mjs`). This does not raise its daily ceiling.

The relayer rejects invalid signatures and stale nonces before broadcasting, serializes submissions and reserves deposits plus gas before each call. Default ceiling: 40 calls and 4 test NEAR reserved per UTC day. The budget ledger persists failed reservations. Gas price above 150 million yoctoNEAR per gas disables sponsorship. Relayer funding may run out before its budget ceiling.

## Integrate

`@tong/sdk` is a workspace package, not published to npm. See the full examples in the demo's **Documentation** tab.

```js
import { TongConnector } from '@tong/sdk';
const tong = new TongConnector({
  contractId: 'tong-d8l0q0.testnet',
  relayerUrl: 'http://127.0.0.1:5371'
});
await tong.connect('evm'); // or 'solana'
await tong.link();
await tong.setNote('Hello, NEAR.');
```

```jsx
import { useTong } from '@tong/sdk/react';
const tong = useTong({ contractId: 'tong-d8l0q0.testnet', relayerUrl });
// Expose tong.connect, tong.link, tong.setNote, tong.signSepolia in your UI.
// Render tong.pending and tong.error; catch rejected promises in click handlers.
```

The SDK always asks the injected wallet to sign. Each action needs a fresh authorization. Fetch the latest nonce after a downstream failure; the nonce is consumed when the factory accepts the authorization, even if an MPC or child receipt later fails.

## Architecture and policy

```mermaid
sequenceDiagram
  participant W as Existing EVM / Solana wallet
  participant S as Tong SDK
  participant R as Bounded relayer
  participant F as Locked NEAR factory
  participant A as Keyless NEAR child
  participant M as Testnet MPC signer
  W->>S: Sign domain + action + data + nonce + expiry
  S->>R: Signed request
  R->>F: execute(request, signature)
  F->>F: Verify host signature + policy; consume nonce
  F->>A: Create / save note / sign Sepolia
  A->>M: sign(payload computed on chain, path, domain 0)
  M-->>S: Signature through NEAR promise chain
```

Canonical EVM identity: `evm:0x<40 lowercase hex>`. Solana: `solana:<64 lowercase public-key hex>`. A child is `first40hex(SHA256(wallet)).<factory>`. MPC derivation uses **the child account as predecessor**, path `tong:sepolia:11155111`, domain 0 (secp256k1). The relayer never owns the derived address.

Allowed actions are `link`, `set_note` (≤256 UTF-8 bytes), and `sign_sepolia`. The outbound contract constructs legacy EIP-155 RLP itself: Sepolia chain ID 11155111, 21,000 gas, no calldata, native value ≤0.001 ETH and gas price ≤100 gwei. It never signs a user-supplied opaque hash. The SDK's Sepolia demo is a zero-value self transfer.

The five-minute request window is independent of the eventual MPC response time. A copied signed request may be relayed first, but its destination, complete action data and nonce are fixed. It cannot be changed or executed twice. The factory cannot upgrade a child, add a key, delete an account, transfer its NEAR balance or change the policy. These constraints deliberately limit usefulness as well as attack surface; read [docs/SECURITY.md](docs/SECURITY.md).

## Agent tools

Run `pnpm mcp` from the repo root, or configure a stdio client with `node /absolute/path/to/tong/packages/mcp/src/index.mjs`. Tools: `tong_identity`, `tong_prepare`, `tong_verify`, `tong_derived_address`, `tong_dry_quote`. The MCP server is read/prepare-only: it cannot sign or submit a transaction.

## Reproduce a new deployment

`pnpm deploy:testnet` creates a fresh faucet-funded factory and relayer using locally generated keys saved with mode 0600. `pnpm demo:testnet` runs both wallet flows, saves every outcome, requests a real MPC signature, validates the signed transaction and fetches a live dry quote. `node scripts/lock-testnet.mjs` verifies code and MPC evidence, deletes the factory's final access key, and records empty key lists. Locking is irreversible. The deployed factory has no upgrade method: changing its code requires a new deployment and domain.

Scripts resume using their local credentials, so an already initialized factory is not deployed again. Do not remove the local credentials between interrupted deployment steps. `pnpm demo:testnet` spends testnet gas and may request another MPC signature when rerun. All testnet transactions are authorized for this build; the scripts refuse non-testnet NEAR account IDs. A separate broadcast script checks Sepolia chain ID and funding before submitting the saved signed transaction.

## Repository

- `packages/contract`: Rust factory; `account/` contains the controlled child contract.
- `packages/sdk`: canonical protocol, injected wallet connector, React hook and Sepolia helpers.
- `packages/relayer`: HTTP sponsorship with persisted spending reservations.
- `packages/mcp`: stdio tools for agent integrations.
- `packages/web`: pearl/coral playground, source documentation and public evidence.
- `tests`: local cryptographic tests and real WASM sandbox adversarial cases.
- `scripts`: builds, deployments, evidence verification and browser checks.

Validation and exact reproduction: [TESTING.md](TESTING.md). Remaining external requirements: [BLOCKED.md](BLOCKED.md). Submission text and X draft: [HACKATHON_SUBMISSION_FORM.md](HACKATHON_SUBMISSION_FORM.md).

## Credits and independence

3D art generated with ChatGPT; supplied before the application build. See [docs/ART-3D.md](docs/ART-3D.md). Manrope by Mikhail Sharanda, Lucide icons. Dependencies: near-sdk, near-api-js, ethers, Noble curves, React, Vite, MCP SDK and Playwright. No prior application code was imported; the sandbox launcher follows the toolchain pattern learned in `near-qday-recovery`. AI assistance: Codex implementation, ChatGPT artwork. Public NEAR RPC, Chain Signatures and 1Click are external services.

Tong is independent of the other NEAR prototypes in this shared local workspace, including Edut, Seter, Kotoba, Juno, Noren, Kumi and Engyē. These local workspace names are disclosure, not claims of submitted projects or public repository links. A human team lead still needs to be assigned under the hackathon's two-project limit. No submission or public push has been made by this build.

Sources checked November 12, 2026: [hackathon rules](https://nearhackathon.com/HACKATHON.md), [Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures), [MPC wire compatibility](https://github.com/near/mpc/blob/main/crates/near-mpc-crypto-types/src/sign.rs), [1Click requests](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request).
