# Tong flow QA, November 14, 2026 (v2 factory + film v8)

Factory: `tongid.testnet`. It is locked, with zero keys; the lock transaction is `H6cmi5CALSeEFywLVwPeSBQY9QJ2rocPbSnsWJNWMa12`.

| Check | Result |
| --- | --- |
| Unit tests | `pnpm test`: 11 passed, 0 failed |
| WASM sandbox | `pnpm test:sandbox`: 24 on-chain checks passed |
| Web build | `pnpm build` passes |
| Script rehearsal (`scripts/demo-v2.mjs`) | 5 successes and 2 on-chain refusals; see [deployments/v2/rehearsal.json](deployments/v2/rehearsal.json) |
| UI rehearsal (`sam.tongid.testnet`) | link `5bi5jnFwawkpRWaymXJPLHtc7jhNBwoBQDZr6UAL8kL9`, wrap `F5CQcZZc7r1XyMBiRvpuTpweLooMkCkh7KfrKvjh8x3z`, refused `6XXFq12o5mAaQdEe1jpiVobZkFtNeLtVWQPTnfsX6Fph`, send `3GyV2MxuMMRuwDDYFw2N3h3jutTT1Pofgt6octLMyHvP`, grant `Aiqz49wCf75GQx25KmBxJr985xZ5VwpLcC8pu1X8sWW7`, guestbook `FkHaj41s5uVuWSkn5YJsh62YJhCWVp3z3ddyttNsP21r` |
| Film take 1 (`maya.tongid.testnet`, rejected: app capture cropped) | link `6vU6WHhwThgFYLLtg4UfHxCmqF68GF9j43sTrD5roNeN`, wrap `BsagCsYgQgttLmTZ9rAHoALXDUonTqYcK5Z9fVVJECgm`, refused `4vQ9GkBXS2SvqQiWJkxL34N5giq1tLQS6DqpWANSYsqi`, send `9K7zuwiBngaGLLL2GRYnLzEoPAcJ8s7j2uDX5nvjTasf`, grant `4YN7hjarc38a1WgFBTaKLg84RLpbNMyi7w8WQMggUmie`, guestbook `DmCsA1FVcjZ2KGq43SLKkS6KyT6Hd5vB6t7fdjRuF2zm`, Chain Signature `GUi8rctFZytrk8Mzvy7NBswMeRNHw5JZQRMenRt1su2v` |

**Film v8 final take** (`mira.tongid.testnet`, fresh scripted EVM wallet `0x16f8a7d6508cfad8b0eab6f0f3b720ea6d658bab`):

| Step | Transaction |
| --- | --- |
| Link | [FzYX1kTe…](https://testnet.nearblocks.io/txns/FzYX1kTe8bogcANzV6nbtUmnAuEn1rjVqfj5HBvv59nd) |
| Wrap 0.1 NEAR | [8Tj3YmCq…](https://testnet.nearblocks.io/txns/8Tj3YmCqqGdY5PL5b7drENyfhFNnnZwAkTYzMoij4daD) |
| **Refused** wrap of 0.5 NEAR | [GiLBrQn7…](https://testnet.nearblocks.io/txns/GiLBrQn7U2V3ivUQwHpMWsJEX7QhUJjrLsYtkFMqyN5p) |
| Send 0.05 NEAR | [3ByxADT7…](https://testnet.nearblocks.io/txns/3ByxADT7pAr7MJRymsZ7SUesJU8EEMbasj3aLncGgNZe) |
| Guestbook grant | [1iim1LzE…](https://testnet.nearblocks.io/txns/1iim1LzE643vnCerjRLhY9ynmj7VJM89DBAG4XCV5eQ) |
| Guestbook post | [BZ1ndRje…](https://testnet.nearblocks.io/txns/BZ1ndRjeEbxc4sAEnmqfpS84T71cQF9ij9BknQAmUHY9) |
| Chain Signature | [6ha8veMV…](https://testnet.nearblocks.io/txns/6ha8veMVhSH3bGHh7R9T8pFDMT18XRhEpKaCyUXHJgk) |

- **Sepolia:** the Chain Signature recovers to `0x21Fc88c5473e6A2e4e3725452316Ee2d21004963`. That address holds 0 wei,
  and so does `0x1b5e316144D8aFB875b4C8Ab751f83F463E4AFa8` (checked Nov 14, publicnode). The transfer was signed, not
  broadcast.
- **Sponsor:** the relayer was topped up with 2 × 9.9 test NEAR from fresh faucet accounts
  ([relayer-topups.json](deployments/v2/relayer-topups.json)). For the takes it ran with `TONG_DAILY_MAX_NEAR=20`; the
  default stays 4 and the hard cap is now 25.
- **Wallet:** approvals come from the Playwright-injected EIP-6963 "QA test wallet", whose key stays in Node. This is
  not a MetaMask or Phantom extension approval.

---

# Tong flow QA — November 13, 2026 (multi-screen rebuild + film v5)

New web app (hash routes `#/`, `#/connect`, `#/app`, `#/app/apps`, `#/app/act`, `#/app/sign`, `#/app/activity`,
`#/app/permissions`, `#/app/developers`). Screens and scores: [UI-JUDGE.md](UI-JUDGE.md).

| Check | Result |
| --- | --- |
| Unit tests | `pnpm test`: 11 passed, 0 failed |
| Web build | `pnpm --filter @tong/web build` passes |
| Overflow | 20 captures (10 routes × 1440/390): 0 px horizontal overflow (`scripts/ui-shots.mjs`) |
| Live flow, rehearsal (linked demo wallet) | note `2qE6GB2vnPh42Hd29FYA7kgya6cPuPioCa9oCCvfSdW1`, Chain Signature `77HEpGsVUZ2yqtaDbzX1qQkqyV1AiSkdhyFXyrsz4hhG` |
| Live flow, film takes (fresh wallets, account created live each time) | take 1: `CZhN8WNzSDEqQJa6KUTbdGgtHLGqkfRpASamPTpbtBfi`, `HrQZEmAHtNMQ5tMqQLM2z7AmNP2YqRCas2h8sBwThUEt`, `3mEBkVG2VrgXyXqpFYXBsZsuugTeckiBKYAeu1CoSoUB`; take 2: `8hnY8KzLUBUHqBSY5xdKLkYBfYq1CsZ6MpUf9xskUAUc`, `9iMZYsKXdgLFoMzcw1SCXrPDMjwdoEKRNgmB1TSxxM3e`, `HXcMhFom32o8ELsbnXHNvwVgpsKCDtZzN3byhzns1w5m`; take 3: `HH2zUP7mw7NN8AWyiJfQxmkdbWJvPnZrrRMXjsBWbWUX`, `8fW4k245AqJDohu7xB3GbxpWqwdswerL3XRFvAkWTZUx`, `4XoQ7uHDeQSdTbF9ZxV7Zet3gcDSNM8fBjWWnfcofzhJ`; take 4 (final film, new art): `ABB7qhQLyEwecGTjYahtpGzGTgyWsthPhrX3BemTmN4n`, `B6zNRCT9otFCDck6rRkcDeXsjF9euksqTbtwL8FK8sUz`, `DPMwsi22eCsbKA2Xv8oHV1TqiHM4keiX9ubxxJtsnmEs` |
| Live flow, film take 5 (Nov 14, signing + explorer pass; wallet shows the signed message, Approve on camera, then explorer) | account `5Bi1CxX9yn8ceMM9GLBDpXM3Dxh2iEXAsN4LCEBxR8ke`, note `3ZyfoG4tQ6SyCNoG5nQ6VDvcAiRh88QJSito8DZ9vdGp`, Chain Signature `B6hrpWpm6152du4FfFnF8HMLmVCPpPdiBZaRQr3FgkA9`; the derived Sepolia address held 0 ETH again, so signed, not broadcast |
| Signed Sepolia transactions | each recovered to its account's derived address; all derived addresses hold 0 Sepolia ETH, so none was broadcast |
| Sepolia funding check | 0x1b5e316144D8aFB875b4C8Ab751f83F463E4AFa8: `eth_getBalance` = 0x0 on Nov 13 (publicnode) |
| Sponsor budget | three takes in one UTC day needed more than the default 4 test NEAR ceiling; the relayer was run with `TONG_DAILY_MAX_NEAR` raised to 8, then 10, for the recordings (default stays 4). Four fresh accounts were created; relayer balance after is roughly 2.9 test NEAR |

Wallet approvals in QA and the film come from a Playwright-injected EIP-6963 "QA test wallet" whose key stays in Node
(`scripts/lib/qa-wallet.mjs`); this is not a MetaMask or Phantom extension approval.

---

# Tong R3 flow QA — November 12, 2026

Start commit: `231db43`. Factory: `tong-d8l0q0.testnet`, unchanged and locked. Scope: targeted documentation, copy and broadcast-preparation fixes. No contract deployment or key deletion.

| Item | Result | Executed evidence |
| --- | --- | --- |
| Dead links | DONE / PASS | Tracked Markdown grep, excluding submission form: zero machine-local path matches. Original result rows retained. |
| Scope claim | DONE / PASS | Full-scope phrase occurs once, only in the README roadmap. Hero, title/meta, README, product context and submission idea use the supported scope. |
| Layout | DONE / PASS | 1440 and 375 px before/after; 12 measured elements per viewport match exactly; CSS unchanged; no horizontal overflow. |
| Prior art | DONE / PASS | README “How Tong differs” cites NEAR account docs, official Ethereum wallets package and NEP-518; own claims link implementation and live evidence. No claim that EVM login or keylessness is new. |
| Wallet extensions | DONE as instructed; human approvals BLOCKED / manual | Zero extensions downloaded or automated. Real MetaMask/Phantom approvals were not executed; TESTING.md retains the human checks. |
| Sepolia preparation | DONE / PASS | One read-only revalidation, expected signer recovered; no new MPC request needed. New evidence file saved beside the untouched original. |
| Sepolia broadcast | BLOCKED | Three no-send preflights selected newest evidence and reported 0 wei balance; exact signed-transaction requirement is 1,344,000 wei (0.000000000001344 Sepolia test ETH). Nick owns funding/broadcast. |
| Unit tests | PASS | 8 executed / 8 passed, including 2 new evidence-selector tests. |
| Web build | PASS | 1 production build executed. |
| Evidence preservation | PASS | 17 start-commit deployment files verified byte-for-byte unchanged. |
| R3 spend | PASS | 0 NEAR writes, 0 test NEAR spent against a 0.3-test-NEAR limit; no ETH requests/transfers, faucet use or broadcast. |

## Signed transaction and money record

New record: [chain-signature-r3-2026-11-12.json](deployments/chain-signature-r3-2026-11-12.json). This **reuses** the valid existing signature and preserves its original signing timestamp; it is not a new MPC response. At revalidation, base fee was 25 wei, 2× target was 50 wei and saved gas price was 64 wei. No conditional re-sign was warranted. The broadcast command checks current fees again; these values are not a promise about future base fees.

- Recovered signer: `0x1b5e316144D8aFB875b4C8Ab751f83F463E4AFa8`.
- Signed Sepolia transaction hash, still **unbroadcast**: `0xfe9f2ca6391830b66b1ce601b1b444899baa632d7949124291e431582e5367c0`.
- Historical MPC request hash (not an R3 write): `2s9kMWVT6UGVSn625LuMGgnTYPzd5e3ikRXZ9trxNUZy`.
- R3 new NEAR transaction hashes: **none**.
- Tong relayer balance check and cumulative spend: [r3-2026-11-12.json](deployments/r3-2026-11-12.json).

Nick's command after manual Sepolia test-ETH funding: `node scripts/broadcast-sepolia.mjs`. It selects the newest signed record and writes append-only submission/receipt records. `--check-only` never sends a transaction.

## Visual evidence

Before/after files: `before-1440.png`, `after-1440.png`, `before-375.png`, `after-375.png` in the local `tong/r3` screenshot folder. Screenshots were captured locally during QA and are not committed. [Layout comparison](deployments/r3-ui-qa-2026-11-12.json) records 24 identical geometry/font records across the two widths. Existing components, sizes, layout, palette, fonts and art were preserved.

R3 did not rerun the earlier 12-check sandbox suite, original paid browser flows or MCP smoke test. No old test outcome is counted as a new R3 execution. No push, public hosting/deployment, post, film change, wallet extension download, mainnet action or contract-key deletion occurred.

## Follow-up acceptance verification — 11:30 UTC

The repeated R3 brief was checked against committed work at `0e58b77`. The dead-link grep remained empty; the broad scope phrase remained roadmap-only. The existing 1440/375 before/after screenshot files were confirmed present, and CSS/contracts still match the original R3 start commit. No UI change or new browser capture was needed.

One additional `node scripts/broadcast-sepolia.mjs --check-only` execution selected the R3 signature record and recovered the same signer. At **2026-11-12T11:30:44.571Z**, base fee was **16 wei** (2× = **32 wei**), below the saved **64 wei/gas**. No fresh MPC request was warranted. Balance remained 0 wei, so the preflight was **BLOCKED** by the same 1,344,000-wei Sepolia test-ETH shortfall. The transaction remains unbroadcast; no new NEAR transaction hashes or spending occurred. [Follow-up preflight](deployments/sepolia-broadcast-20261112T113044571Z-fe9f2ca639-check.json).

This follow-up ran **1 no-send preflight, 0 unit/build/browser reruns, 0 wallet-extension operations, 0 chain writes**, bringing the recorded R3 no-send preflight count to 3. Previous signed evidence files remain unchanged.
