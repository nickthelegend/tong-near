# Security model

Tong is a testnet prototype, not audited. Host signature verification establishes authorization; it does not establish a wallet owner's real-world identity or prove that their browser is trustworthy.

## Trust boundaries

- An injected wallet and the user decide whether to sign. EVM uses EIP-712 with a factory-specific salt; Solana uses exact UTF-8 bytes. A compromised dApp can ask the user to sign an unwanted permitted action. Read the action and destination in the wallet.
- The factory validates the canonical wallet, signature, domain, nonce, deadline and exact action schema. It consumes the nonce before creating a promise. Anyone may pay to relay a valid authorization; only the fixed signed action can occur.
- Child contracts trust only their factory. They are deployed without keys, have no upgrade method and never accept calls from the relayer directly.
- Chain Signatures relies on the external MPC network. Child predecessor + path determines its signing key. An MPC timeout does not restore the consumed nonce. The code and current public key of the external signer are not controlled by Tong.
- The local sponsorship relayer owns only its testnet gas funds. Its mutable configuration and local budget ledger are operator responsibilities. A different relayer can pay to call the factory without bypassing signature checks.
- Public RPC responses are transport-trusted. The SDK checks recovered MPC signatures against an RPC-derived key, not a light-client verified proof. It checks destination chain ID before broadcast.

## Invariants and defenses

| Threat | Defense |
| --- | --- |
| Signature replay | Per-identity uint64 nonce consumed before external calls |
| Cross-factory/network replay | Domain `near:testnet:<factory>`, included in every signature |
| Long-lived authorization | Deadline ≥ current block seconds and ≤ current time + 300 |
| Signer substitution | Recovered EVM address or ed25519 key equals the signed canonical identity |
| Payload substitution | Signature binds action plus the exact JSON string |
| Opaque transaction hash abuse | Child constructs Sepolia EIP-155 payload from typed bounded fields |
| Cross-chain outbound replay | Fixed chain 11155111 and Sepolia-specific derivation path |
| Arbitrary code execution | Only link, note, and native transfer signing; no calldata, deploy or key actions |
| Child authorization bypass | Predecessor equals immutable factory |
| Storage sponsorship drain | On-chain exact link deposit covers factory and child storage; relayer pre-validates and reserves budget |
| False success | Account marked ready only by private creation callback; SDK waits for receipts and reads child state |

## Limits to keep visible

1. One wallet controls one account **per factory**, not one globally portable account. There is no EVM↔Solana identity merge or account recovery.
2. Linking costs 1.65 test NEAR. The relayer pays 1.6 into the child to cover its WASM/storage, retaining no ownership. Factory retains 0.05 for identity storage. Note edits are bounded; a larger code build must re-evaluate the storage deposit before deployment.
3. A failed link leaves a consumed nonce and a non-ready record. There is no retry/recovery method. Inspect the receipt; use a fresh deployment if needed. A failed downstream note/MPC call also consumes the nonce by design.
4. No NEAR balance withdrawal exists. Do not deposit user assets. Child contracts can only edit their own note or spend a forwarded MPC fee. MPC refunds may remain in the child.
5. A signed Sepolia native transfer can spend up to 0.001 test ETH plus gas. Re-signing multiple transactions is not a cumulative spending limit; the user authorizes each one. This is not an agent allowance or session-key system.
6. A bounded native transfer to a contract may fail with the fixed 21,000 gas limit. The browser demo targets its own derived address with zero value.
7. Wallet mobile transport, WalletConnect sessions, account/chain event subscriptions, recovery and production token flows are not implemented. Reconnect when switching wallet accounts; signature recovery catches a mismatched signer.
8. Relayer availability, funds, RPC, MPC timeouts and 1Click route liquidity can fail independently. No mock transaction substitutes for a failed request.
9. The budget limits gas purchase per action and caps the count. It reserves 0.1 test NEAR gas plus the attached deposit before broadcasting; sponsorship refuses a live gas price above 150 million yoctoNEAR per gas. Preserve the ledger and run one relayer for that ledger/key. Manual edits or multiple ledgers can defeat the operator's own limit.
10. EIP-712 and Solana confirmations present different wallet UX. The temporary EVM test wallet is explicitly labeled and ephemeral; its private key exists only in browser memory and is lost on reload.
