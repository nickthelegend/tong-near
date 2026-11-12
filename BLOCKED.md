# Remaining external requirements

## Sepolia broadcast — BLOCKED

The saved MPC signature recovers to `0x1b5e316144D8aFB875b4C8Ab751f83F463E4AFa8`. R3 revalidated it against a live Sepolia block: **25 wei base fee**, **50 wei at 2× base fee**, versus the saved **64 wei/gas**. The saved transaction was not underpriced, so the conditional fresh MPC request was not needed. This is reuse of the existing signature, not a claim of a new MPC response. The original [chain-signature.json](deployments/chain-signature.json) is unchanged; the separate [R3 signed-transaction evidence](deployments/chain-signature-r3-2026-11-12.json) records the fee check and recovered signer.

The follow-up preflight at **11:30 UTC** found a **16-wei base fee** (2× = 32 wei), so the same 64-wei signature remains adequately priced at that check. No replacement signature was required.

For this zero-value, 21,000-gas signed transaction, the exact maximum debit is **1,344,000 wei = 0.000000000001344 Sepolia test ETH**. Its recorded balance remains **0 wei**, so the shortfall is the full amount. That amount funds this exact signature only; it does not guarantee the gas price stays above a future base fee. The command rechecks the live fee, nonce and balance and refuses an underpriced or stale transaction.

Sepolia test ETH funding and broadcast are **Nick's manual step**. R3 made no faucet request, ETH transfer or broadcast, and spent **0 test NEAR**. No real/mainnet ETH is needed or requested. After Nick supplies Sepolia test ETH, the one command is:

```sh
node scripts/broadcast-sepolia.mjs
```

The command selects the newest timestamped signed-transaction evidence, verifies the signer against the current derived public key, and writes separate broadcast/receipt records without altering signed evidence. `node scripts/broadcast-sepolia.mjs --check-only` sends nothing; R3 ran it three times and got **BLOCKED: insufficient Sepolia test ETH**. If the live base fee later exceeds 64 wei, a new app-authorized signature is required before broadcasting; no changed transaction can reuse this signature.

## Wallet extension approvals — BLOCKED / manual

No MetaMask or Phantom extension was downloaded or automated in R3, as explicitly instructed. A human still needs to connect and approve the real-wallet flows in `TESTING.md`. The earlier Playwright-injected provider does not count as either extension's approval test.

## Public demo and submission — pending human tasks

- No public hosting target or public repository URL was supplied. Local demo and static build are complete; relayer credentials remain local. No push or public repository change was made.
- A unique team lead, contact email, team size and mainnet prize payout account must be supplied by the human. The lead must stay within the hackathon's two-project limit, with independence disclosed.
- The human must publish an X demo post, provide its URL, agree to the exact contact notice and confirm the final JSON payload before any submission. No post or submission has been sent.
- For a local-only entry, record a demo video; organizer rules require a video when judges cannot open a hosted demo. Desktop and mobile screenshots are available in the shared orchestration screenshot folder; do not represent them as a published demo video.

## Product boundaries, not completed integrations

- 1Click has no testnet. Tong only requests **mainnet dry quotes**, never a funding transaction or deposit address. The quote in evidence is timestamped and will expire.
- The connector supports injected EVM and Solana signing APIs. WalletConnect mobile transport and broad wallet compatibility certification are pending.
- Generic dApp contract calls, recovery, arbitrary outbound chains, token transfers and an audited production release are outside this MVP's strict allowlist.
- Sponsorship is finite. It depends on a locally funded testnet relayer, rate limits and the persistent daily budget. A public production relayer is not hosted by this build.
