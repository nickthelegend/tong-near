# Tong submission preparation

Not submitted. Do not send a second application for an already submitted repository. Re-read [the live organizer instructions](https://nearhackathon.com/HACKATHON.md) before submission. Deadline: **November 14, 2026 at 23:59 UTC**.

## Settled fields

- Project: **Tong** (通, “to connect”)
- Tracks: **`open`, `defi`, `security`**
- Development: new application written November 12, 2026; supplied 3D assets and license preceded the application. No imported prior product implementation.
- Deployment: **`tongid.testnet`** (v2: named accounts and on-chain policy; locked before the final film, zero access keys). v1 `tong-d8l0q0.testnet` stays live and locked.
- One-line pitch: **Tong gives your MetaMask or Phantom wallet a named NEAR account. A sponsor pays the gas, and the spending limits are enforced by the NEAR contract itself, not by an app.**

## Idea / what we built

Tong lets an existing EVM or Solana wallet run a named NEAR account.

- **Account:** one EIP-712 or ed25519 signature creates `maya.tongid.testnet`, an account with zero access keys controlled only by a locked Rust factory.
- **Per-request checks:** the factory verifies every later request with NEAR host functions (`ecrecover`, `ed25519_verify`). It binds each request to its domain, a one-use nonce and a deadline of at most 5 minutes.
- **On-chain policy:** each account has its own:
  - app allowlist (contract + methods, per-call deposit cap, expiry);
  - per-transfer cap;
  - daily allowance.
- **Live demos on testnet:**
  - wrapping NEAR on `wrap.testnet`;
  - a third-party dApp (the NEAR Guestbook) that asks for a grant through the SDK and posts;
  - capped NEAR sends;
  - a capped Sepolia transfer signed by Chain Signatures from the named account.
- **Refusals are real:** the sponsor relayer pays gas but does no policy pre-check, so over-limit and unpermitted calls are refused on chain with a receipt.
- **Developer surface:** an SDK, a React hook, MCP tools and a six-line demo dApp.

The comparison with NEP-518, HOT, NEAR Intents, embedded wallets and function-call keys is in `docs/POSITIONING.md`. It states plainly where those are better (protocol-native, audited, larger user base).

Not done:

- The Sepolia transfer is signed, not broadcast, because the derived address has no test ETH.
- 1Click is a labelled mainnet dry quote.

## Track rationale

- Open: named NEAR accounts for EVM and Solana wallets, with a live contract, an SDK and a third-party demo dApp.
- DeFi: outbound Chain Signatures plus live NEAR Intents 1Click dry quotes; neither a completed swap nor a funded Sepolia transaction is claimed.
- Security: host signature verification, domain separation, one-use nonces, expiry, keyless accounts, and per-account policy enforced on chain. This is backed by 24 adversarial WASM sandbox checks and live on-chain refusals.

## Human-owned fields still required

Team lead's name; contact email; team size (one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+`); mainnet prize payout account; public repository URL; public X demo post URL. Do not infer these from local credentials or the license. Confirm this lead has at most two independent submissions and disclose the other project, if any.

Contact notice, verbatim:

> I agree that the organizers may use these details to review our submission and contact us about this hackathon.

The final API payload must contain exactly `requestId`, `projectName`, `leadName`, `email`, `size`, `tracks`, `nearAddress`, `projectUrl`, `demoUrl`, `idea`, `consent`. Generate the request ID once, keep the same ID for a network retry, and do not commit the personal payload. Present the complete concrete JSON to the human and wait for explicit confirmation before POSTing. This document is a draft, not that confirmation.

## X post draft

Your wallet should be your way in — not another setup step.

Built Tong 通 at NEAR HACKATHON: your MetaMask or Phantom wallet gets a named NEAR account, gas is sponsored, and spending limits are enforced on chain. It's live with wrap.testnet, the NEAR Guestbook and Chain Signatures. Sepolia broadcast awaits test ETH.

@NEARProtocol #NEARHackathon

Attach a real demo video showing wallet → signed note → receipt → MPC result. Add the final public demo and repository links when available. The human edits and publishes this draft; the agent does not post it.

## Demo recording sequence

1. Open the playground with the local sponsorship relayer running.
2. Connect an existing EVM wallet (or explicitly label the temporary test-wallet option).
3. Sign creation, then sign a note; show the read-back note and NEAR receipt.
4. Request a zero-value Sepolia self-transfer signature. Show the verified raw transaction and the explicit unbroadcast state.
5. Show the recorded ed25519 account proof and live 1Click mainnet dry quote.
6. End on the source documentation, tests and honest blockers. Do not imply a swap or Sepolia transfer completed.
