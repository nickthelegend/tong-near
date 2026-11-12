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
