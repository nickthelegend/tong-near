# Remaining external requirements

## Sepolia broadcast — BLOCKED

A real signature was returned by testnet MPC and assembled into a signed EIP-155 Sepolia transaction. Recovered address: `0x1b5e316144D8aFB875b4C8Ab751f83F463E4AFa8`. At capture the derived address had **0 wei**. [deployments/chain-signature.json](deployments/chain-signature.json) records the exact gas requirement, signed bytes and NEAR request receipt.

A no-CAPTCHA faucet was found: [RPC Gateway Sepolia](https://rpc.aurpay.net/faucets/ethereum-sepolia). Its [published eligibility](https://rpc.aurpay.net/docs/faucet) requires the receiving address already hold 0.0001 ETH on Ethereum mainnet. This freshly derived test address is not eligible. No mainnet funds were sent. The [PoW faucet](https://sepolia-faucet.pk910.de/) requires browser mining work; the usual Google faucet requires a human account. No CAPTCHA, login or anti-bot requirement was bypassed.

To unblock, send a small amount of **Sepolia test ETH** to the derived address, then run `node scripts/broadcast-sepolia.mjs`. That script verifies chain ID, recovered signer, nonce and balance before broadcasting the saved transaction. It records the broadcast and receipt honestly; an underpriced saved transaction requires a fresh user-signed request, not a changed transaction under the old signature.

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
