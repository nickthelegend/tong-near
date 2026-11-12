# Tong
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Rust NEAR contracts, JavaScript connector SDK with a React hook, Node relayer and MCP server, React demo. The user specified the contract, SDK and package structure; implementation choices fill the remaining details.

## Users
Existing EVM and Solana wallet holders trying a NEAR dApp, dApp developers adding a connector, and hackathon judges reproducing the flow.

## Product Purpose
EVM or Solana wallets acting on NEAR, with Chain Signatures to Sepolia. Prove foreign-wallet authorization on NEAR and outbound signing through Chain Signatures without asking the user to create a NEAR key.

## Capabilities and Constraints
Testnet only. EIP-712 secp256k1 and domain-separated ed25519 requests, deterministic controlled accounts, nonces, expiry and bounded actions. 1Click is an explicitly labeled mainnet dry quote, never a testnet bridge. Record real transactions; disclose external blocks.

## Brand Commitments
Tong (通, to connect). Iridescent pearl and warm coral; no teal, blue or purple as the visual identity. WalletConnect/Reown, Privy, Dynamic and RainbowKit docs are the user-specified craft references. Preserve supplied 3D art.

## Evidence on Hand
Eleven supplied 3D assets and docs/ART-3D.md. No application or deployment existed at handoff. Deployment evidence must be generated.

## Product Principles
Keep the existing wallet. Verify authorization on chain. Show only confirmed results. Make integration legible to a developer.
