import React, { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, KeyRound, LockKeyhole, ShieldCheck, TimerReset, Ban, Minus, X as XIcon } from "lucide-react";
import { CONTRACT_ID, DEPLOYMENT, accessKeys, factoryLatest, nearAccount, nearTx, short, timeAgo } from "../lib/chain.js";
import { useTongApp } from "../lib/tong.jsx";
import { EthMark, SolMark, NearMark, Ext, Skeleton } from "../components/ui.jsx";
import { Logo } from "../components/Logo.jsx";

function useLiveStats() {
  const [s, setS] = useState({});
  useEffect(() => {
    let on = true;
    factoryLatest()
      .then((t) => on && setS((x) => ({ ...x, latest: t })))
      .catch((e) => on && setS((x) => ({ ...x, latestError: e.message })));
    accessKeys(CONTRACT_ID)
      .then((k) => on && setS((x) => ({ ...x, keys: k.length })))
      .catch((e) => on && setS((x) => ({ ...x, keysError: e.message })));
    return () => {
      on = false;
    };
  }, []);
  return s;
}

const FAQ = [
  [
    "Isn't this what NEAR's Ethereum wallet support already does?",
    "NEAR's NEP-518 gives MetaMask a 0x… account that pays its own gas and has no spending limits. Tong adds a readable name, sponsored gas, Solana wallets and limits the contract enforces. NEP-518 is protocol-native and audited; Tong is a testnet prototype.",
  ],
  [
    "Do I need a NEAR wallet or a new seed phrase?",
    "No. You sign with MetaMask, Rabby, Phantom or any injected EVM or Solana wallet. Tong's contract checks that signature on NEAR and acts from an account that belongs to your wallet.",
  ],
  [
    "Who holds the keys to my NEAR account?",
    "Nobody. Your Tong account is created with zero access keys. Only the locked Tong contract can call it, and only after your wallet signs that exact action and it fits your limits.",
  ],
  [
    "How does it sign for Ethereum?",
    "Your NEAR account asks NEAR's Chain Signatures network (v1.signer-prod.testnet) to sign. It derives an Ethereum address that belongs to your NEAR account, so a single wallet signature reaches another chain.",
  ],
  [
    "What can Tong do today?",
    "Create a named NEAR account, wrap NEAR on wrap.testnet, post to the NEAR Guestbook, send NEAR, save a note, and sign capped Sepolia transfers. Every request expires in five minutes and runs once.",
  ],
  [
    "Is this live?",
    "Yes, on NEAR testnet and Sepolia test ETH. Tong is a hackathon build, not audited infrastructure. Use test funds only.",
  ],
];


const Y = ({ t }) => (
  <span className="w-yes">
    <Check size={14} /> {t}
  </span>
);
const N = ({ t }) => (
  <span className="w-no">
    <XIcon size={14} /> {t}
  </span>
);
const P = ({ t }) => (
  <span className="w-part">
    <Minus size={14} /> {t}
  </span>
);
const WHY = [
  {
    name: "NEAR Ethereum wallets",
    how: "NEP-518 eth-implicit accounts via NEAR Connect",
    src: "https://github.com/near/NEPs/blob/master/neps/nep-0518.md",
    cells: [<Y t="EVM only" />, <N t="0x… address" />, <N t="Your account pays" />, <N t="None" />, <P t="Through apps" />],
  },
  {
    name: "HOT Wallet / HOT Kit",
    how: "HOT's own MPC network; Kit connects wallets",
    src: "https://hot-labs.gitbook.io/hot-protocol/hot-kit",
    cells: [<P t="Kit yes, wallet makes a new key" />, <P t="Not documented" />, <P t="Some intents" />, <P t="Not documented" />, <Y t="HOT MPC" />],
  },
  {
    name: "Embedded wallets",
    how: "Privy, Dynamic, Web3Auth on NEAR",
    src: "https://docs.privy.io/recipes/use-tier-2",
    cells: [<N t="New key via login" />, <N t="64-hex account" />, <N t="Not on NEAR" />, <P t="Off chain, EVM-first" />, <N t="No" />],
  },
  {
    name: "NEAR Intents",
    how: "intents.near verifies ETH and Solana signatures",
    src: "https://docs.near-intents.org/near-intents/market-makers/verifier/signing-intents",
    cells: [<Y t="EVM + Solana" />, <N t="A balance, not an account" />, <P t="Solvers execute" />, <P t="Per intent" />, <N t="Swaps only" />],
  },
  {
    name: "Function-call keys + relayer",
    how: "NEP-366 meta-transactions",
    src: "https://docs.near.org/protocol/accounts-contracts/access-keys",
    cells: [<N t="Needs a NEAR key" />, <Y t="Yes" />, <Y t="Yes" />, <P t="1 contract, no deposits, no daily cap" />, <N t="No" />],
  },
];
function WhyTong() {
  return (
    <section className="l-section l-why" id="why">
      <div className="l-head">
        <h2>Other ways in, and what each one misses.</h2>
        <p>Every piece of Tong exists somewhere. Nothing we found puts all five together. Checked Nov 14, 2026; sources linked.</p>
      </div>
      <div className="why-wrap">
        <table className="why-table">
          <thead>
            <tr>
              <th />
              <th>Wallet you already have</th>
              <th>Readable NEAR name</th>
              <th>Gas paid for you</th>
              <th>Limits enforced on chain</th>
              <th>Signs other chains</th>
            </tr>
          </thead>
          <tbody>
            <tr className="why-tong">
              <th>
                <b>Tong</b>
                <small>this build, NEAR testnet</small>
              </th>
              <td>
                <Y t="EVM + Solana" />
              </td>
              <td>
                <Y t="maya.tongid.testnet" />
              </td>
              <td>
                <Y t="Sponsor, budgeted" />
              </td>
              <td>
                <Y t="Allowlist, caps, daily, expiry" />
              </td>
              <td>
                <Y t="Chain Signatures" />
              </td>
            </tr>
            {WHY.map((r) => (
              <tr key={r.name}>
                <th>
                  <b>{r.name}</b>
                  <small>
                    {r.how}{" "}
                    <a href={r.src} target="_blank" rel="noreferrer" aria-label={`Source for ${r.name}`}>
                      source
                    </a>
                  </small>
                </th>
                {r.cells.map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="why-honest">
        <b>Where others win:</b> NEP-518 is built into the protocol and audited. HOT has over a million users and many chains. Privy's policy
        engine is far more mature. Tong is a testnet prototype: unaudited, one sponsor, Sepolia only.
      </p>
    </section>
  );
}

export default function Landing() {
  const stats = useLiveStats();
  const { health } = useTongApp();
  const [open, setOpen] = useState(0);
  const last = stats.latest?.[0];
  return (
    <div className="landing">
      <header className="l-nav">
        <a href="#/" className="brand-link" aria-label="Tong home">
          <Logo />
        </a>
        <nav aria-label="Main">
          <a href="#why">Why Tong</a>
          <a href="#how">How it works</a>
          <a href="#/app/apps">Apps</a>
          <a href="#/app/developers">Developers</a>
          <a href="#security">Security</a>
        </nav>
        <a className="btn btn-light" href="#/connect">
          Launch app <ArrowRight size={16} />
        </a>
      </header>

      <section className="l-hero">
        <div className="l-hero-copy">
          <p className="kicker">
            <NearMark size={14} /> Live on NEAR testnet
          </p>
          <h1>Use NEAR with the wallet you already have.</h1>
          <p className="l-sub">
            Tong gives your MetaMask or Phantom wallet a named NEAR account. The sponsor pays the gas, and spending limits
            are enforced by NEAR itself, not by an app.
          </p>
          <div className="l-cta">
            <a className="btn btn-coral btn-lg" href="#/connect">
              Connect your wallet <ArrowRight size={18} />
            </a>
            <a className="btn btn-ghost-dark btn-lg" href="#/app/developers">
              Add Tong to your app
            </a>
          </div>
          <ul className="l-hero-facts">
            <li>
              <Check size={15} /> No seed phrase
            </li>
            <li>
              <Check size={15} /> A real name: you.tongid.testnet
            </li>
            <li>
              <Check size={15} /> Limits NEAR enforces
            </li>
          </ul>
        </div>
        <div className="l-hero-stage">
          <img className="l-hero-art" src="/art/v2/plug-socket.webp" alt="" />
          <div className="l-widget" aria-label="Tong connect preview">
            <div className="l-widget-head">
              <Logo small />
              <span>Sign in to NEAR</span>
            </div>
            <a className="l-wallet" href="#/connect">
              <span className="w-ico w-eth">
                <EthMark />
              </span>
              <span>
                <strong>Ethereum wallet</strong>
                <small>MetaMask, Rabby, Coinbase</small>
              </span>
              <ArrowRight size={16} />
            </a>
            <a className="l-wallet" href="#/connect">
              <span className="w-ico w-sol">
                <SolMark />
              </span>
              <span>
                <strong>Solana wallet</strong>
                <small>Phantom, Solflare, Backpack</small>
              </span>
              <ArrowRight size={16} />
            </a>
            <div className="l-widget-result">
              <span className="dot-live" />
              <span>
                0x98f5…e479 is <b>maya.{CONTRACT_ID}</b>
              </span>
            </div>
            <p className="l-widget-foot">Your keys stay in your wallet.</p>
          </div>
        </div>
      </section>

      <section className="l-stats" aria-label="Live network facts">
        <div>
          <strong>{stats.keys === undefined ? (stats.keysError ? "—" : <Skeleton w={40} h={44} />) : stats.keys}</strong>
          <span>
            access keys on the Tong contract. <Ext href={nearAccount(CONTRACT_ID)}>Check it</Ext>
          </span>
        </div>
        <div>
          <strong>{last ? timeAgo(last.at) : stats.latestError ? "—" : <Skeleton w={120} h={44} />}</strong>
          <span>
            since the last Tong transaction.{" "}
            {last && <Ext href={nearTx(last.hash)}>{short(last.hash, 5, 4)}</Ext>}
          </span>
        </div>
        <div>
          <strong>5 min</strong>
          <span>maximum life of any signature you give Tong.</span>
        </div>
        <div>
          <strong>{health ? `${health.budget?.calls ?? 0}/${health.budget?.maxCalls ?? 40}` : "—"}</strong>
          <span>{health ? "sponsored actions used today." : "Sponsor offline: reads still work."}</span>
        </div>
      </section>

      <WhyTong />

      <section className="l-section" id="how">
        <div className="l-head">
          <h2>One signature. A NEAR account that acts for you.</h2>
          <p>The same three steps you'll see in the app, on real contracts.</p>
        </div>
        <div className="l-how">
          <article className="how-card">
            <div className="how-ui">
              <div className="mini-row">
                <span className="w-ico w-eth">
                  <EthMark size={16} />
                </span>
                <span>0x98f5…e479</span>
                <span className="pill-ok">Connected</span>
              </div>
              <div className="mini-sign">
                <span>Sign request</span>
                <code>action: link · name: maya</code>
                <code>nonce: 0 · expires 4:00</code>
              </div>
            </div>
            <h3>Connect and sign</h3>
            <p>Your wallet signs a typed request. No new app to install, no NEAR seed.</p>
          </article>
          <article className="how-card">
            <div className="how-ui">
              <div className="mini-account">
                <NearMark size={18} />
                <div>
                  <b>maya.{CONTRACT_ID}</b>
                  <small>0 access keys · controlled by your wallet</small>
                </div>
              </div>
              <div className="mini-note">wrap.testnet · near_deposit · 0.1 NEAR ✓</div>
            </div>
            <h3>Act on NEAR</h3>
            <p>Wrap NEAR, post, send. The contract checks your signature and your limits, then your account acts.</p>
          </article>
          <article className="how-card">
            <div className="how-ui">
              <div className="mini-xchain">
                <span>
                  <NearMark size={15} /> NEAR MPC
                </span>
                <ArrowRight size={14} />
                <span>
                  <EthMark size={15} /> Sepolia
                </span>
              </div>
              <code className="mini-raw">0xf86380…67c0 · signer 0x1b5e…FA8</code>
            </div>
            <h3>Sign for Ethereum</h3>
            <p>Chain Signatures signs a capped transfer from an Ethereum address your NEAR account owns.</p>
          </article>
        </div>
      </section>

      <section className="l-section l-bento">
        <article className="bento bento-wide bento-pearl">
          <div>
            <h3>A NEAR name, owned by your signature</h3>
            <p>
              Pick <code>maya.{CONTRACT_ID}</code>. It has zero keys: only your wallet's signature moves it, on every device.
            </p>
            <a className="text-link" href="#/connect">
              Find yours <ArrowUpRight size={15} />
            </a>
          </div>
          <img src="/art/v2/two-keys.webp" alt="" loading="lazy" />
        </article>
        <article className="bento bento-coral">
          <img src="/art/v2/signature-bridge.webp" alt="" loading="lazy" />
          <h3>Reach Ethereum from NEAR</h3>
          <p>NEAR Chain Signatures signs from an address derived for your account.</p>
        </article>
        <article className="bento">
          <img src="/art/v2/wallet.webp" alt="" loading="lazy" />
          <h3>Your wallet stays yours</h3>
          <p>Keys never leave MetaMask or Phantom. Tong only sees signatures, each for one capped action.</p>
        </article>
        <article className="bento bento-wide bento-ink">
          <div>
            <h3>Drop it into any NEAR app</h3>
            <p>A connector, a React hook and agent tools. Your users keep their wallet.</p>
            <a className="text-link light" href="#/app/developers">
              Read the SDK <ArrowUpRight size={15} />
            </a>
          </div>
          <pre className="bento-code">
            <code>{`const tong = new TongConnector({ contractId })
await tong.connect('evm')
await tong.grant(app, ['add_message'], '0', 7)
await tong.call(app, 'add_message', { text })`}</code>
          </pre>
        </article>
      </section>

      <section className="l-section l-security" id="security">
        <div className="l-head light">
          <h2>What Tong can never do.</h2>
          <p>
            The contract is locked: its last key was deleted on {new Date(DEPLOYMENT.locked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
            No upgrade path, no admin.
          </p>
        </div>
        <div className="sec-grid">
          <div>
            <KeyRound size={20} />
            <h3>Add a key to your account</h3>
            <p>Your Tong account has zero access keys. Nobody can log in to it.</p>
          </div>
          <div>
            <Ban size={20} />
            <h3>Sign an arbitrary hash</h3>
            <p>Your NEAR account builds the Ethereum transaction itself, so a hidden payload can't slip through.</p>
          </div>
          <div>
            <TimerReset size={20} />
            <h3>Replay your signature</h3>
            <p>Each request names one action, one nonce and a deadline under five minutes.</p>
          </div>
          <div>
            <LockKeyhole size={20} />
            <h3>Exceed your limits</h3>
            <p>Over the per-call cap, past the daily allowance, or an app you never allowed: the contract refuses it on chain.</p>
          </div>
        </div>
        <div className="sec-proof">
          <ShieldCheck size={18} />
          <span>
            Factory <b>{CONTRACT_ID}</b> · code hash {short(DEPLOYMENT.code_hash, 6, 4)}
          </span>
          <Ext href={nearAccount(CONTRACT_ID)}>Inspect on NearBlocks</Ext>
        </div>
      </section>

      <section className="l-section l-faq">
        <div className="l-head">
          <h2>Questions</h2>
        </div>
        <div className="faq">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={open === i ? "faq-item open" : "faq-item"}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                {q}
                <ChevronDown size={18} />
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="l-final">
        <div className="l-final-card">
          <div>
            <h2>Your wallet already works here.</h2>
            <p>MetaMask or Phantom in, a NEAR account out. One signature.</p>
            <a className="btn btn-coral btn-lg" href="#/connect">
              Connect your wallet <ArrowRight size={18} />
            </a>
          </div>
          <img src="/art/v2/hero.jpg" alt="A pearl plug and a coral plug joined by one adapter" width="1400" height="933" />
        </div>
      </section>

      <footer className="l-footer">
        <Logo />
        <div className="f-cols">
          <div>
            <b>Product</b>
            <a href="#/connect">Connect</a>
            <a href="#/app/apps">Apps</a>
            <a href="#/app/activity">Activity</a>
          </div>
          <div>
            <b>Build</b>
            <a href="#/app/developers">SDK</a>
            <a href="#/app/permissions">Permissions</a>
            <Ext href={nearAccount(CONTRACT_ID)}>Contract</Ext>
          </div>
        </div>
        <p className="f-fine">Built at NEAR HACKATHON 2026 · Testnet only · MIT</p>
      </footer>
    </div>
  );
}
