# Tong 3D object kit

One object per image, studio light, rounded bevels, a tiny friendly face on the connector objects only. Generated with
ChatGPT's image model on 2026-11-12, one image per message in a single chat, downloaded as blobs. Files are
transparent WebP, 640 x 640, in `packages/web/public/art/3d/`.

- **Material:** iridescent pearl: a glossy pearlescent white body with a soft, warm iridescent sheen in peach,
  champagne and blush tones only.
- **Palette:** pearl `#F7EFEC`, coral-pink details `#FF7A88`, peach rim light `#FFB8A0`, face ink deep coral
  `#C9485B`. No teal, no blue and no purple anywhere (each prompt bans them).
- **Face:** two small round deep-coral dot eyes and a short curved smile. Only on the connector objects: the plug, the
  bridge arch and the two chain-link states. Everything else has no face.
- **Background:** transparent (real alpha, no ground shadow). On a dark UI add a soft `#FFB8A0` radial light behind an
  object so the pearl rim reads.
- **Subjects:** connecting a wallet from any chain to NEAR: plug and socket, keys, a bridge, a signature, chain links,
  a wallet, a networked globe, and the success, warning and logo states.

## Shared style line (appended to every prompt)

> Iridescent pearl 3D render: a glossy pearlescent white body (#F7EFEC) with a soft warm iridescent sheen in peach,
> champagne and blush tones only, warm coral-pink (#FF7A88) details, a soft peach (#FFB8A0) rim light, soft studio
> lighting, crisp reflections, rounded bevelled edges, gentle toy-like proportions, {FACE}, no teal, no blue, no purple
> anywhere, one object centred with generous empty margin on every side and nothing cropped, transparent background
> (real alpha, no background, no ground shadow, no checkerboard pattern), square 1024x1024, no text, no letters, no
> numbers, no logos.

`{FACE}` is either `a tiny friendly face on the <part> only: two small round deep coral (#C9485B) dot eyes and a short
curved smile` or `no face and no eyes`. Each prompt was `Create an image: <subject>. <style line>`.

## Files

| File | Subject prompt | Face | Intended use |
|---|---|---|---|
| `plug-and-socket.webp` | a chunky rounded plug about to slot into its matching round socket; the two pieces face each other with a small gap between them, the plug has coral-pink prongs and a short coral-pink cable | plug | hero object; "connect a wallet" CTA |
| `key-ring.webp` | a round key ring holding four different chunky keys fanned out, each key with a slightly different rounded bow shape, coral-pink ring and coral-pink accents on the keys | none | multi-chain keys (EVM secp256k1, Solana ed25519) feature card |
| `bridge.webp` | a small chunky arched bridge spanning a gap between two short rounded pillars, a smooth single arch with a coral-pink deck rail, seen from a three-quarter angle, no water, no landscape | bridge arch | cross-chain / move funds (1Click) feature card |
| `signature-pen.webp` | a chunky rounded signature pen lying diagonally with a coral-pink nib and coral-pink grip ring, drawing a short smooth coral-pink curved flourish line beneath its tip (an abstract swoosh, not letters or a word) | none | sign-a-message step; Chain Signatures feature card |
| `links-unlinked.webp` | two chunky rounded oval chain links lying side by side, apart and NOT connected, a small empty gap between them, each link with a thin coral-pink band | each link | "not linked yet" state |
| `links-linked.webp` | two chunky rounded oval chain links interlocked and joined through each other, each link with a thin coral-pink band, both looking happy (asked for a fresh render with true alpha) | each link | "linked to NEAR account" state |
| `wallet.webp` | a chunky rounded wallet, closed, with a coral-pink clasp strap across the front and one plain coral-pink coin (blank face, no symbol) peeking out of the top | none | connected wallet / balances card |
| `globe-nodes.webp` | a pearl globe with softly raised blank continents, circled by a tilted orbit of small coral-pink nodes connected by thin coral-pink lines, like a network around the world | none | "any chain" section; supported chains |
| `success-check.webp` | a success badge: a thick rounded pearl disc with a raised chunky coral-pink checkmark in its centre | none | success toast / verified signature |
| `warning.webp` | a rounded triangular warning sign with a raised chunky coral-pink exclamation mark in its centre | none | error state (bad signature, setup required) |
| `logo-mark.webp` | an app logo mark: two thick rounded rings interlocking side by side, the left ring pearl and the right ring coral-pink, seen straight from the front, minimal and symmetric, bold shapes that stay readable at 32 pixels | none | logo-mark candidate; favicon / app icon |

All eleven were checked on light and dark backgrounds and at 48 px. The first `links-linked` render had a painted
checkerboard instead of transparency and was regenerated.

README credit: "3D art generated with ChatGPT".
