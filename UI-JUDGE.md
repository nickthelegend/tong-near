# Tong UI judge — November 13, 2026 (rebuild)

Strict pass against the captured leaders (privy.io and dynamic.xyz landings, rainbow.me and phantom.com phone views;
internal references only) and the Dribbble picks in `design-references/picks/tong-v2.md`. Screenshots of every
route at 1440 and 390 are in the shared orchestration folder `shots/tong/v3/`; `report.json` there records
**0 px horizontal overflow on all 20 captures**. All numbers on screen come from NEAR testnet, Sepolia, NearBlocks v3
or the local relayer.

| Screen | Leader structure | Score | Notes |
| --- | --- | --- | --- |
| Landing `#/` | Privy/Dynamic: nav, hero + live widget, stats, how it works, bento, security, FAQ, CTA, footer | 8.5 | Live facts (contract keys, last Tong tx, sponsor use). Hero art moved clear of the widget text after review |
| Connect `#/connect` | Rainbow/Privy modal: detected, install, other | 9 | EIP-6963 detection, install links, temporary wallet, then create-account step with derived account ID and step tracker |
| Account `#/app` | Privy dashboard + Rainbow action circles | 8.5 | Live balance, key count, nonce, linked wallets, NEAR and Sepolia addresses, note, receipts |
| Apps `#/app/apps` | App directory cards | 8 | Live 1Click dry quote inline; roadmap apps honestly marked |
| Act `#/app/act` | Compose + signature preview | 9 | Exact EIP-712 fields with countdown, steps, read-back from chain |
| Cross-chain `#/app/sign` | Swap-style from/to panels | 8.5 | Policy checks, MPC signature, recovered signer, broadcast or funded-state copy in wei |
| Activity `#/app/activity` | Explorer table + detail drawer | 9 | Receipt drawer reads `tx` from NEAR RPC (payer, wallet, action, nonce, gas, block) |
| Permissions `#/app/permissions` | Settings/limits | 8.5 | `get_config`, child and factory key counts, sponsor meters |
| Developers `#/app/developers` | Docs + code tabs | 8.5 | React, JS, schema, MCP; live config JSON |
| Phone (all routes) | Rainbow tab bar | 8.5 | Bottom tab bar + More sheet; fixed cross-chain input overflow and activity row layout after pass 1 |

Fixed during the pass: sidebar double highlight (Account + current page), mobile cross-chain inputs overflowing,
activity rows on mobile, "0 ETH" gas copy for sub-gwei costs, hero art covering the widget.
