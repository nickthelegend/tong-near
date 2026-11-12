# Tong submission preparation

Not submitted. Do not send a second application for an already submitted repository. Re-read [the live organizer instructions](https://nearhackathon.com/HACKATHON.md) before submission. Deadline: **November 14, 2026 at 23:59 UTC**.

## Settled fields

- Project: **Tong** (通, “to connect”)
- Tracks: **`open`, `defi`, `security`**
- Development: new application written November 12, 2026; supplied 3D assets and license preceded the application. No imported prior product implementation.
- Deployment: **`tong-d8l0q0.testnet`**, locked, zero access keys.

## Idea / what we built

Tong lets an existing EVM or Solana wallet act on NEAR, with outbound Chain Signatures to Sepolia. A controlled NEAR account avoids creating another seed phrase. A Rust contract verifies EIP-712 secp256k1 or ed25519 signatures with NEAR host functions, binds every request to its factory domain, nonce and expiry, and executes only a small action allowlist. Each wallet gets a deterministic keyless subaccount. That child computes a bounded Sepolia transaction hash on chain and requests a real NEAR Chain Signature for its own derived address. The working entry includes a vanilla connector, React hook, gas-budgeted relayer, MCP read/prepare tools, and a pearl/coral playground with docs and inspectable receipts. Both signature types and signed NEAR actions ran on testnet. A real MPC response was assembled and verified; Sepolia broadcast is blocked by missing test ETH. 1Click is integrated as an honestly labeled live mainnet dry quote, with no transfer or testnet bridge claim.

## Track rationale

- Open: reusable foreign-wallet connector with a live NEAR contract and SDK.
- DeFi: outbound Chain Signatures plus live NEAR Intents 1Click dry quotes; neither a completed swap nor a funded Sepolia transaction is claimed.
- Security: host signature verification, domain separation, strict nonces, expiry, keyless contracts and per-action limits, backed by adversarial WASM sandbox checks.

## Human-owned fields still required

Team lead's name; contact email; team size (one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`); mainnet prize payout account; public repository URL; public X demo post URL. Do not infer these from local credentials or the license. Confirm this lead has at most two independent submissions and disclose the other project, if any.

Contact notice, verbatim:

> I agree that the organizers may use these details to review our submission and contact us about this hackathon.

The final API payload must contain exactly `requestId`, `projectName`, `leadName`, `email`, `size`, `tracks`, `nearAddress`, `projectUrl`, `demoUrl`, `idea`, `consent`. Generate the request ID once, keep the same ID for a network retry, and do not commit the personal payload. Present the complete concrete JSON to the human and wait for explicit confirmation before POSTing. This document is a draft, not that confirmation.

## X post draft

Your wallet should be your way in — not another setup step.

Built Tong 通 at NEAR HACKATHON: EVM + Solana signatures verified on NEAR, keyless accounts, and a real outbound Chain Signature. Sepolia broadcast awaits test ETH; 1Click is a dry quote.

@NEARProtocol #NEARHackathon

Attach a real demo video showing wallet → signed note → receipt → MPC result. Add the final public demo and repository links when available. The human edits and publishes this draft; the agent does not post it.

## Demo recording sequence

1. Open the playground with the local sponsorship relayer running.
2. Connect an existing EVM wallet (or explicitly label the temporary test-wallet option).
3. Sign creation, then sign a note; show the read-back note and NEAR receipt.
4. Request a zero-value Sepolia self-transfer signature. Show the verified raw transaction and the explicit unbroadcast state.
5. Show the recorded ed25519 account proof and live 1Click mainnet dry quote.
6. End on the source documentation, tests and honest blockers. Do not imply a swap or Sepolia transfer completed.
