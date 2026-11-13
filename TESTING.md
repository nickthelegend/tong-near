# Verification and reproduction

All test wallets are generated locally. No personal wallet, existing seed phrase or mainnet signing key is used. Testnet evidence is timestamped; inspect the live account for current nonces and balances.

## Completed checks

| Layer | Result | Evidence |
| --- | --- | --- |
| SDK and budget | 6 tests passed | `pnpm test` |
| WASM sandbox | 12 adversarial on-chain checks passed | [sandbox-tests.json](deployments/sandbox-tests.json) |
| Live testnet deployment | Factory + two distinct child accounts, actual EVM/ed25519 actions | [transactions.json](deployments/transactions.json) |
| MPC | Real signature, exact Sepolia payload, recovered derived signer | [chain-signature.json](deployments/chain-signature.json) |
| Code and lock | Live WASM hashes match local binaries, zero factory/child keys | [verification.json](deployments/verification.json), [lock-proof.json](deployments/lock-proof.json) |
| Browser | Real EIP-712 note + MPC through relayer; responsive/docs/error/dry-quote checks | [browser-tests.json](deployments/browser-tests.json), [relayer-transactions.jsonl](deployments/relayer-transactions.jsonl) |
| Relayer policy | Invalid signature/replay rejected, one real note, persisted 0.1 NEAR reserve | [relayer-tests.json](deployments/relayer-tests.json) |
| MCP | Five scoped tools, live identity, nonce preparation, invalid-signature rejection, derived address | [mcp-tests.json](deployments/mcp-tests.json) |
| 1Click | Successful live mainnet dry quote; no transfer | [oneclick-dry-quote.json](deployments/oneclick-dry-quote.json) |
| Sepolia broadcast | BLOCKED by 0 test ETH; saved transaction rechecked | [broadcast-attempt.json](deployments/broadcast-attempt.json) |
| Web production build | Vite build passed | `pnpm build` |

The first browser run completed the live note and MPC calls, then stopped at an overly exact documentation heading locator. The locator was corrected and the remaining checks rerun in read-only mode, avoiding duplicate chain writes. The real submitted browser transactions remain in the relayer ledger. No mocked success was used.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build:contract
pnpm test:sandbox
pnpm build
pnpm verify:testnet
pnpm test:mcp
```

`pnpm test` has no network dependency. It verifies typed-data and ed25519 signing, payload tampering, policy bounds, persisted budgets, concurrent reservation safety and missing-wallet errors.

`pnpm test:sandbox` deploys the optimized factory WASM into near-sandbox 2.14.0-rc.4 and executes the actual host functions. It does not substitute a JavaScript signature verifier for the contract. The launcher uses ports **5380/5381**, creates local validator/account keys in a temporary directory, and kills its node and removes the directory on exit. Build first. Set `NEAR_SANDBOX_BIN` to an existing binary to avoid the download.

Sandbox cases:

1. Valid EVM EIP-712 authorization creates a controlled child.
2. Exact signed request replay is rejected.
3. Wrong EVM signer is rejected.
4. Expired request is rejected.
5. Wrong factory domain is rejected.
6. Disallowed action is rejected.
7. Tampered JSON data is rejected.
8. Signed NEAR note action executes and is read back from the child.
9. Direct child call from the relayer is rejected.
10. Valid ed25519 authorization creates a distinct child with zero keys.
11. Wrong ed25519 signer is rejected.
12. Sepolia transfer value above the allowlist limit is rejected on chain.

## Live deployment verification

`pnpm verify:testnet` is read-only on chain. It waits for final outcomes for archived transactions, compares the live base58 code hash with the SHA-256 of local optimized WASM, checks empty key lists for factory and both children, reads signed notes and independently recovers the saved MPC transaction's signer. It updates evidence files locally.

The faucet account creation response is stored separately from transaction-call receipts. The extra testnet gas reserve faucet and top-up are also recorded; they do not change the relayer's daily spending ceiling.

## Browser verification

Start one web server (`pnpm dev`, port **5310**) and the local HTTP relayer (`pnpm relayer`, port **5311**). The relayer needs the gitignored local testnet key file. Then:

```sh
pnpm test:browser
```

The full browser check uses the locally generated EVM demo key from `.near-credentials/demo-wallets.json` through a Playwright injected test provider. It does not export the key into a screenshot, log or web asset. The provider signs real requests; actual calls go to live testnet through the normal HTTP relayer. It saves a note, requests a Chain Signature and checks the recovered address. This command spends testnet gas.

`node scripts/browser-test.mjs --read-only` skips those already verified writes and checks 1440/375 playground and documentation layouts, a live dry quote, missing-wallet recovery, and temporary-wallet labeling. It writes [browser-tests.json](deployments/browser-tests.json). No real browser extension has been automated; actual wallet vendor compatibility still requires manual testing.

Headless Chrome launches are protected by the shared `withChromeLock` helper. Every browser closes in `finally`. Screenshots are kept **outside the repo** at `tong`, including initial before, final after, connected and documentation views at 1440 and 375 px. `scripts/screenshots.mjs` and `scripts/browser-test.mjs` use that machine-specific shared path; change the path and lock import on another machine. Screenshots were captured locally during QA and are not committed.

## Manual wallet checks

- In MetaMask/Rabby-compatible injection, connect and inspect the EIP-712 factory-specific domain, action, exact data, nonce and deadline before signing. Reject a signature and verify the UI recovers without a success receipt.
- In Phantom-compatible injection, connect and inspect the canonical Tong UTF-8 message. Approve a link and note, then check the ed25519 wallet's distinct child in the explorer.
- Switching wallet accounts requires reconnecting. A mismatched returned signature is rejected locally and on chain.
- Disable extensions and click Connect: expect installation guidance. The optional temporary wallet must be explicitly labeled and must still wait for a signed creation request.
- Exhaust the local sponsorship budget: expect an error before submitting a transaction. Preserve the ledger when restarting.

## Build facts

Toolchain pinned to Rust 1.95.0 and near-sdk 5.30.0-rc.1; `unstable` enables the SDK's `env::ecrecover` wrapper. `cargo near build non-reproducible-wasm --no-abi` runs wasm-opt for a runtime-compatible artifact. Both dependency lockfiles are committed. The parent embeds the freshly built optimized child WASM; build child first.

Reference hashes are in [testnet.json](deployments/testnet.json). The build command embeds provenance including local build paths, so the optimized local file and live code hash are verified directly; this is not a claim of independently reproducible container builds.

## Honest limits

Sandbox tests exercise real NEAR WASM but do not recreate the external MPC cluster. Live testnet captures cover MPC success. No load test, third-party security audit, live Solana extension automation, mainnet transfer, executed swap or funded Sepolia broadcast is claimed. See [BLOCKED.md](BLOCKED.md).

## R3 targeted checks (November 12, 2026)

- **8 unit tests executed, 8 PASS** with `pnpm test`: the six existing protocol/budget tests plus two newest-evidence selection tests. The selector is tested against timestamps rather than filesystem write order and leaves the original fixture unchanged.
- **1 Sepolia preparation/revalidation executed, PASS** with `node scripts/r3-prepare-sepolia.mjs`. The current base fee was 25 wei; the saved gas price was 64 wei, above the 50-wei 2× target. No new MPC request or NEAR transaction was necessary. [chain-signature-r3-2026-11-12.json](deployments/chain-signature-r3-2026-11-12.json) includes the existing signature, its original signing timestamp, the new fee check and recovered signer. Existing evidence was not overwritten.
- **3 broadcast preflights executed, all BLOCKED** with `node scripts/broadcast-sepolia.mjs --check-only`: the newest evidence was selected, the signer matched, but balance was 0 wei against a 1,344,000-wei requirement. This option cannot send a transaction.
- **0 new NEAR transactions, 0 test NEAR spent**, against the 0.3-test-NEAR R3 limit. Tong's own relayer was identified using the `TONG_RELAYER_KEY_FILE` path, and its balance was checked read-only. [r3-2026-11-12.json](deployments/r3-2026-11-12.json) records the balance, empty transaction list and cumulative spend.
- **0 wallet extensions downloaded or automated.** Human MetaMask and Phantom approval remains **BLOCKED / manual** under the explicit R3 instruction. The manual checks above still apply; a Playwright test provider is not a real wallet extension.

R3 did not rerun the 12-check WASM sandbox suite or the original paid browser flows; their earlier results remain historical evidence, not additional R3 executions.

### R3 copy and layout acceptance

The unsupported full-scope claim now appears only in the README roadmap. The hero, page title/description, product context and submission idea describe EVM or Solana wallets acting on NEAR, with Chain Signatures to Sepolia. The dead-link grep over tracked Markdown (excluding the submission form) prints nothing.

Before/after QA checked **2 viewports: 1440 and 375 px**, with **12 element geometry/font records identical at each width**, no horizontal overflow and no CSS changes. [r3-ui-qa-2026-11-12.json](deployments/r3-ui-qa-2026-11-12.json) records the result. Screenshot files are `before-1440.png`, `after-1440.png`, `before-375.png` and `after-375.png` in the local `tong/r3` screenshot folder. Screenshots were captured locally during QA and are not committed.

**1 production web build executed, PASS** with `pnpm --filter @tong/web build`. The copy detector returned no findings. **17 original deployment evidence files were compared with the R3 start commit and remain byte-for-byte unchanged**; see [r3-preservation-2026-11-12.json](deployments/r3-preservation-2026-11-12.json). No contracts, keys, films, public hosting or repository remotes were changed.

### Follow-up verification of the repeated R3 brief

One additional no-send preflight at 11:30 UTC found a 16-wei Sepolia base fee, below the saved 64-wei gas price and its 32-wei 2× target. It selected `chain-signature-r3-2026-11-12.json`, verified the signer and remained **BLOCKED** by 0 wei balance. Evidence: [sepolia-broadcast-20261112T113044571Z-fe9f2ca639-check.json](deployments/sepolia-broadcast-20261112T113044571Z-fe9f2ca639-check.json). No fresh signing, broadcast, test/build rerun, UI change or wallet download occurred. Total R3 spending remains 0 test NEAR.
