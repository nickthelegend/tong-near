# Positioning: what already exists, and what Tong adds

Checked on 2026-11-14 against current official docs. Every claim about another product links to its source.
Where a fact could not be verified, it says so. "Nobody else does X" is an absence claim from one round of
research, not proof.

**One line:** Tong gives your MetaMask or Phantom wallet a named NEAR account. The sponsor pays the gas, and the
spending limits are enforced by the NEAR contract itself, not by an app.

## How each option works today

### 1. NEAR's own Ethereum-wallet support (NEP-518, NEAR Connect)

- **Account:** an *eth-implicit* account whose ID is the Ethereum address itself (`0x` + 40 hex). A transfer to
  the address creates it, and the protocol points it at a wallet contract. The account has no access keys: the
  Ethereum key acts as its only key. ([NEP-518](https://github.com/near/NEPs/blob/master/neps/nep-0518.md))
- **What it can do:** `FunctionCall`, `Transfer`, and `AddKey`/`DeleteKey` for ed25519 or secp256k1 keys only.
  It can't add a full-access key, deploy, or batch several actions. It emulates ERC-20 `transfer`, `balanceOf` and
  `totalSupply`. It is audited and live since protocol version 70. (NEP-518)
- **Gas:** a relayer holds a function-call key on the user's account and calls `rlp_execute`. In the NEP's words, the
  relayer "does not need to cover any gas costs". So the user's 0x account pays its own gas. (NEP-518)
- **Wallet:** the `@near-wallet-selector/ethereum-wallets` package turns NEAR actions into Ethereum transactions. It
  runs multiple actions one at a time and doesn't implement `signMessage`.
  ([README](https://github.com/near/wallet-selector/blob/main/packages/ethereum-wallets/README.md))
  - wallet-selector was archived on Nov 10, 2026. NEAR now points apps to NEAR Connect, which lists "Ethereum
    Wallets". ([wallet-selector](https://github.com/near/wallet-selector),
    [NEAR Connect](https://docs.near.org/web3-apps/tutorials/wallet-login))
- **Limits:** none per action. **Name:** the account is a 0x hex ID. Nothing says one can be given a name
  (unverified). **Solana:** not covered.

### 2. Solana and ed25519 keys on NEAR

- NEAR's implicit accounts are 64-hex ed25519 public keys, so a Solana public key maps to one in principle.
  ([account IDs](https://docs.near.org/protocol/accounts-contracts/account-id))
- No wallet-selector or NEAR Connect integration for Solana wallets was found.
- Phantom's docs don't say whether `signMessage` will sign a raw NEAR transaction hash. Unverified.
  ([Phantom](https://docs.phantom.com/solana/signing-a-message))

### 3. NEAR Intents (`intents.near`)

- The verifier contract already accepts Ethereum (ERC-191), Solana raw ed25519 (Phantom), passkey, TON, Tron and
  Stellar signatures. ([signing intents](https://docs.near-intents.org/near-intents/market-makers/verifier/signing-intents))
- The signer identifies a **balance inside that contract**, not a NEAR account that can call any app.
- 1Click is a swap API on top of it, with a deposit address per quote.
  ([1Click](https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api))

### 4. HOT (HOT Labs)

- **HOT Protocol** is an MPC network with core logic on NEAR. Nodes call view methods on each wallet's
  authorization contracts before signing, and it covers ECDSA and EdDSA chains.
  ([signature generation](https://hot-labs.gitbook.io/hot-protocol/mpc-wallet/signature-generation-via-mpc.md))
  - Spending-limit policies are not documented: those pages are marked "To be added".
- **Omni Balance** is a signed-intent balance contract on NEAR. It accepts EIP-191/712, Solana ed25519, NEP-413,
  TON and Stellar signers, and "all fees can be subsidized".
  ([Omni Balance](https://hot-labs.gitbook.io/hot-protocol/hot-omni-balance))
- **HOT Kit** connects existing NEAR, EVM, Solana, TON, Stellar, TRON and Cosmos wallets.
  ([HOT Kit](https://hot-labs.gitbook.io/hot-protocol/hot-kit))
- **HOT Wallet** itself creates a new key (seed or MPC).
- HOT reports 1M+ Omni Balance users (its own May 2025 claim).

### 5. Embedded wallets

- **Privy:** NEAR is a "Tier 2" chain. Privy creates a *new* NEAR implicit account and signs its hash.
  ([Privy tier 2](https://docs.privy.io/recipes/use-tier-2))
  - Gas sponsorship needs Tier 3. ([chains](https://docs.privy.io/wallets/overview/chains))
  - Its policy engine (transfer limits, allowlists, time-bound signers) is mature but runs off chain. NEAR isn't
    listed among policy chain types. ([policies](https://docs.privy.io/controls/policies/overview))
- **Dynamic:** derives a NEAR implicit account from its embedded Solana key.
  ([Dynamic NEAR](https://www.dynamic.xyz/docs/javascript/reference/tier-2-chains/near.md))
- **Web3Auth (MetaMask Embedded Wallets):** social login, then a converted ed25519 key; "no native provider for
  Near". ([docs](https://docs.metamask.io/embedded-wallets/connect-blockchain/other/near/))
- **Particle Universal Accounts:** NEAR is not supported.
  ([chains](https://developers.particle.network/universal-accounts/chains.md))
- **None of these** lets an existing MetaMask or Phantom wallet control a NEAR account.

### 6. NEAR's native permissions and chain-abstraction tools

- **Function-call access keys:** limited to one receiver contract, an optional method list and a gas allowance.
  They "do not allow to attach NEAR tokens", and the docs list no expiry or daily caps.
  ([access keys](https://docs.near.org/protocol/accounts-contracts/access-keys))
- **Meta-transactions (NEP-366):** a relayer pays gas (and attached deposits). The signed action carries a nonce
  and a block-height expiry, but the user still signs with a NEAR key.
  ([NEP-366](https://github.com/near/NEPs/blob/master/neps/nep-0366.md),
  [meta-tx docs](https://docs.near.org/protocol/transactions/meta-tx))
- **Chain Signatures:** NEAR accounts sign for other chains through the MPC contract (`v1.signer-prod.testnet` on
  testnet). ([Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures))
  - NEAR's own tutorial adds an MPC-derived key as a *full-access* key on a NEAR account.
    ([tutorial](https://docs.near.org/chain-abstraction/chain-signatures/tutorials/controlling-near-accounts/1-setup.md))
- **Bitte / near-ca:** "controlling Ethereum EOAs from a Near Account". This runs NEAR → EVM, the opposite
  direction. ([near-ca](https://github.com/BitteProtocol/near-ca))
- **NEAR Auth / FastAuth:** Web2 login (Auth0, passkeys) plus an MPC signature.
  ([NEAR Auth](https://docs.near.org/web3-apps/tutorials/near-auth))
- **EVM analogue of per-action limits:** session keys with spend and time limits.
  - ZeroDev call, rate and time policies. ([ZeroDev](https://docs.zerodev.app/sdk/permissions/intro))
  - ERC-7715, which is still a Draft. ([EIP-7715](https://eips.ethereum.org/EIPS/eip-7715))
  - MetaMask's periodic native-token permission.
    ([MetaMask](https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/use-permissions/native-token/))
  - These are more mature than Tong, but EVM only.

## Comparison

Key: Y = yes, N = no, P = partial, U = unverified.

| | Wallet you already have, no new seed | Readable NEAR name | Gas paid for you | Limits enforced on chain | Signs other chains |
|---|---|---|---|---|---|
| **Tong (this repo, testnet)** | **Y, EVM + Solana** | **Y, `maya.tongid.testnet`** | **Y, budgeted sponsor** | **Y: allowlist, per-call cap, daily cap, expiry, one-use nonce** | **Y, Chain Signatures (Sepolia, capped)** |
| NEP-518 / NEAR Connect | Y, EVM only | N, 0x ID | N, the account pays | N | P, through apps |
| NEAR Intents | Y, EVM + Solana | N, a balance in a contract | P, solvers execute | P, per intent | N, swaps |
| HOT Kit / Wallet | Kit Y; wallet makes a new key | U | P, some intents | U, not documented | Y, HOT MPC |
| Privy / Dynamic / Web3Auth | N, new key | N, implicit hex | N on NEAR | P, off chain, EVM-first | N |
| Function-call key + NEP-366 relayer | N, needs a NEAR key | Y | Y | P: one contract, no deposits, no daily cap | N |

## Tong's edge, verified in this repository

Each claim points to code and to a live testnet transaction.

1. **A named NEAR account owned by your existing wallet's signature, with no new seed phrase.**
   - `link` with `{"name":"maya"}` creates `maya.tongid.testnet`, deploys the account contract and initializes it
     with the factory as its only controller. The account has zero access keys.
     ([factory `execute`, link branch](../packages/contract/src/lib.rs),
     [account contract](../packages/contract/account/src/lib.rs))
   - Live:
     [4GZAPy8E…](https://testnet.nearblocks.io/txns/4GZAPy8EQEvvhbtVBy3RycuVc4S4chsSUjxybGTeZs9v),
     [A7maKkNg…](https://testnet.nearblocks.io/txns/A7maKkNgV6Rbys3Y1W43qfkP5i1Aop5EYK4DqEKRGBsz).
   - EVM signatures are checked with `env::ecrecover` (EIP-712) and Solana signatures with `env::ed25519_verify`.
2. **Gas paid by the sponsor relayer.**
   - The relayer signs and pays for every `execute`, under a persistent daily budget.
     ([relayer core](../packages/relayer/src/core.mjs))
   - App deposits and NEAR sends come from the user's own account, never from the sponsor: the factory rejects a
     relayer deposit on `call` and `send_near`.
3. **Per-action policy limits enforced on chain.**
   - Each account's policy lives in the factory: an app allowlist (contract + methods), a per-call deposit cap, an
     expiry per grant, a per-transfer cap and a daily allowance.
   - Each request also carries a one-use nonce and a deadline of at most 5 minutes.
   - The relayer deliberately does no policy pre-check, so refusals are real on-chain failures:
     - Over the cap ("0.5 NEAR is over the 0.2 NEAR per-call limit for wrap.testnet"):
       [CGc1uAAr…](https://testnet.nearblocks.io/txns/CGc1uAArvQzQiJbqNzuf85Pdknpy4xxye6ZZgusC4pSV)
     - No permission ("no permission for guestbook.near-examples.testnet"):
       [5MftM3q4…](https://testnet.nearblocks.io/txns/5MftM3q4GCfNtgPn3TusKpqKzE3M3MN2kpCYmCtN6LxZ)
   - The same paths, plus daily-cap, revoke and replay refusals, are covered by 24 sandbox checks
     ([tests/sandbox.mjs](../tests/sandbox.mjs)).
4. **A real NEAR dApp, used through Tong.**
   - Wrap 0.1 NEAR on `wrap.testnet`:
     [HLkyVk8D…](https://testnet.nearblocks.io/txns/HLkyVk8D24BN1zaj9oM3TgPEbzxVaZpffitkqAHfzA2f)
   - Grant the NEAR Guestbook:
     [H8btJuxG…](https://testnet.nearblocks.io/txns/H8btJuxGAvxNR71d9CwRopTR7baXfcUPVBwKQG1YAVqJ)
   - Sign the guestbook:
     [2wd1Phaf…](https://testnet.nearblocks.io/txns/2wd1PhafVv16ggLgjQAy1wrTQ5bwQXQvkNPdjFWmfYjX)
   - Send 0.05 NEAR:
     [5muqUPm6…](https://testnet.nearblocks.io/txns/5muqUPm6U7jrZrpLG4eVHpn1ghFGjR1LeBUsZoRGkTps)
5. **The same account signs for another chain under the same policy model.**
   - `sign_sepolia` makes the named account the MPC predecessor. The account builds the EIP-155 transaction on chain
     (no opaque hashes), capped at 0.001 ETH and 100 gwei.
6. **A few-lines SDK for dApps.**
   - `#/demo` is a separate dApp that uses only `@tong/sdk`: `connect`, `grant`, `call`. It posts to the real NEAR
     Guestbook. ([Demo.jsx](../packages/web/src/pages/Demo.jsx), [SDK](../packages/sdk/src/index.mjs))

## Where others are equal or better (said plainly)

- **NEP-518** is protocol-native, audited and listed in NEAR Connect. For an Ethereum user who just wants a NEAR
  account, it is the safer default today.
- **NEAR Intents and HOT Omni** already verify EIP-712 and Solana ed25519 signatures on NEAR and run gasless.
  Tong's signature verification is not novel.
- **HOT** has a large user base, many chains and its own MPC network. Tong has one sponsor and Sepolia only.
- **Privy, ZeroDev and MetaMask permissions** are far more mature policy engines, though off-NEAR or off-chain.
- **Tong is a testnet prototype.** It is unaudited, has one relayer, a fixed default policy and no recovery, and
  supports injected wallets only (no WalletConnect mobile yet). The Sepolia transfer is signed but not broadcast,
  because the derived address holds no test ETH.
