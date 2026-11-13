# Tong art set (UI overhaul, Nov 13 2026)

Generated with ChatGPT's image model (chatgpt.com, one fresh chat, one image per message, no reference images).
Soft editorial still life in pearl-glazed porcelain with coral enamel on warm peach paper: use NEAR apps with the
wallet you already have, shown as two different plugs meeting through one adapter, two different keys on one ring,
a bridge paved with signature seals. It keeps Tong's pearl/coral palette. No faces (the older kit's faces are
dropped), no teal, blue or purple, no text.

## Palette (unchanged, from `docs/ART-3D.md` and `packages/web/src/style.css`)
| Role | Hex |
|---|---|
| Pearl (objects, light surfaces) | `#F7EFEC` |
| Coral (the accent: details, CTA) | `#FF7A88` |
| Deep coral (text-safe accent in the UI) | `#cc4256` |
| Peach (hero/OG backdrop) | `#FFE3D8` |
| Peach rim / bounce light | `#FFB8A0` |
| Ink | `#292321` |

## Style line (appended to every prompt)
> Soft editorial still-life photograph of real objects: slender, finely made porcelain with a satin pearl glaze
> #F7EFEC (a subtle warm sheen, no rainbow iridescence), small details in coral-pink #FF7A88 enamel, soft diffused
> morning daylight, gentle soft shadows, a faint peach #FFB8A0 bounce light, realistic proportions and fine detail,
> airy, calm and expensive like a design-magazine homeware spread; not chunky, not a 3D cartoon, not toy-like, no
> high-gloss plastic, no chrome, no face, no eyes, no people, no hands, no teal, no blue, no purple anywhere; no text,
> no letters, no numbers, no logos, no symbols.

Hero and OG prompts add "on a seamless warm peach #FFE3D8 paper backdrop". `tong-wallet.png` came from the first
pass of this chat, whose style line asked for "pearlescent white glazed ceramic … peach and champagne tones" on peach
paper. The re-render had its cable cut off at the frame edge, so the first pass was kept.

## Files
| File | Size | Background | Intended use |
|---|---|---|---|
| `tong-hero.png` | 1536×1024 | peach | Landing hero: pearl plug + coral plug joined by one adapter, a diagonal across the centre-right; headline sits top-left |
| `tong-og.png` | 1536×1024 | peach | OG / social card: two keys on a ring beside the adapter, right half; title on the left |
| `tong-icon.png` | 1024×1024 | transparent outside the tile | App icon / logo-mark candidate: pearl tile with interlocking pearl and coral rings (check at 32 px) |
| `tong-two-keys.png` | 1024×1024 | transparent | Feature: keep your Ethereum or Solana key (two different keys, one ring) |
| `tong-signature-bridge.png` | 1024×1024 | transparent | Feature: a bridge of signatures (wallet signature verified on NEAR, then Chain Signatures) |
| `tong-plug-socket.png` | 1024×1024 | transparent | Feature: connect any wallet / "Connect" CTA |
| `tong-wallet.png` | 1024×1024 | transparent | Feature: the wallet you already have, plugged into NEAR apps; connected-wallet card |
| `tong-empty.png` | 1024×1024 | transparent | Empty state: no wallet connected / nothing linked yet (coiled, unplugged cable) |

Transparent objects are trimmed to their bounds and padded to a square with an even margin, then palette-compressed
with pngquant. Hero and OG are the untouched originals; convert them to WebP/JPEG (q 82–88) when wiring them in.

README credit: "Art generated with ChatGPT".
