import React, { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, KeyRound, LockKeyhole, ShieldCheck, TimerReset, Ban } from "lucide-react";
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
    "Do I need a NEAR wallet or a new seed phrase?",
    "No. You sign with MetaMask, Rabby, Phantom or any injected EVM or Solana wallet. Tong's contract checks that signature on NEAR and acts from an account that belongs to your wallet.",
  ],
  [
    "Who holds the keys to my NEAR account?",
    "Nobody. Your Tong account is created with zero access keys. Only the locked Tong contract can call it, and only after your wallet signs that exact action.",
  ],
  [
    "How does it sign for Ethereum?",
    "Your NEAR account asks NEAR's Chain Signatures network (v1.signer-prod.testnet) to sign. It derives an Ethereum address that belongs to your NEAR account, so a single wallet signature reaches another chain.",
  ],
  [
    "What can Tong do today?",
    "Create your account, save a signed note on NEAR, and sign capped Sepolia transfers (at most 0.001 ETH). Every action expires in five minutes and can run only once.",
  ],
  [
    "Is this live?",
    "Yes, on NEAR testnet and Sepolia test ETH. Tong is a hackathon build, not audited infrastructure. Use test funds only.",
  ],
];

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
            Sign in with MetaMask or Phantom. Tong turns that signature into a NEAR account that acts for you, and signs
            for Ethereum with Chain Signatures.
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
              <Check size={15} /> Zero keys on your account
            </li>
            <li>
              <Check size={15} /> Gas sponsored on testnet
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
                0x98f5…e479 is <b>dbec…08e2.{CONTRACT_ID}</b>
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
                <code>action: link</code>
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
                  <b>dbec…08e2.{CONTRACT_ID}</b>
                  <small>0 access keys · controlled by your wallet</small>
                </div>
              </div>
              <div className="mini-note">“Hello, NEAR. From my own wallet.”</div>
            </div>
            <h3>Act on NEAR</h3>
            <p>The contract verifies your signature on chain, then your NEAR account does exactly that action.</p>
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
            <h3>One NEAR account per wallet</h3>
            <p>
              Every MetaMask or Phantom address maps to its own account under <code>{CONTRACT_ID}</code>. Same wallet, same
              account, on every device.
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
await tong.link()
await tong.setNote('Hello, NEAR.')`}</code>
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
            <h3>Exceed the caps</h3>
            <p>Sepolia transfers stop at 0.001 ETH and 100 gwei. Notes stop at 256 bytes.</p>
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
