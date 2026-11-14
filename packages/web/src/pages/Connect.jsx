import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, FlaskConical, ShieldCheck, X } from "lucide-react";
import { useTongApp, useDetectedWallets } from "../lib/tong.jsx";
import { CONTRACT_ID, nearTx, shortAccount, walletLabel, formatNear, nameAvailable } from "../lib/chain.js";
import { NAME_RE } from "@tong/sdk";

/* Live availability of <name>.<factory>, read from the contract. */
function useName(initial) {
  const [name, setName] = useState(initial);
  const [check, setCheck] = useState({ state: "idle" });
  useEffect(() => {
    if (!name) return setCheck({ state: "idle" });
    if (!NAME_RE.test(name)) return setCheck({ state: "bad", text: "2–32 lowercase letters, digits, - or _" });
    setCheck({ state: "checking" });
    let on = true;
    const t = setTimeout(() => {
      nameAvailable(name)
        .then((ok) => on && setCheck(ok ? { state: "ok", text: "Available" } : { state: "taken", text: "Taken. Try another." }))
        .catch((e) => on && setCheck({ state: "bad", text: e.message.slice(0, 80) }));
    }, 350);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [name]);
  return [name, setName, check];
}
import { EthMark, SolMark, NearMark, Spinner, ErrorNote, Steps, Ext, cx } from "../components/ui.jsx";
import { Logo } from "../components/Logo.jsx";

const INSTALL = {
  evm: [
    ["MetaMask", "https://metamask.io/download/"],
    ["Rabby", "https://rabby.io/"],
    ["Coinbase Wallet", "https://www.coinbase.com/wallet/downloads"],
  ],
  solana: [
    ["Phantom", "https://phantom.com/download"],
    ["Solflare", "https://solflare.com/download"],
  ],
};

function WalletRow({ option, onPick, busy }) {
  return (
    <button type="button" className="wallet-row" onClick={() => onPick(option)} disabled={!!busy}>
      <span className={cx("w-ico", option.kind === "evm" ? "w-eth" : "w-sol")}>
        {option.icon ? <img src={option.icon} alt="" /> : option.kind === "evm" ? <EthMark /> : <SolMark />}
      </span>
      <span className="wallet-name">
        <strong>{option.name}</strong>
        <small>{option.kind === "evm" ? "Ethereum · EIP-712" : "Solana · ed25519"}</small>
      </span>
      {busy === option.id ? <Spinner /> : <span className="chip chip-ok">Detected</span>}
    </button>
  );
}

export default function Connect() {
  const tong = useTongApp();
  const detected = useDetectedWallets();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const connected = tong.canSign;
  const linked = tong.identity?.ready;
  const [name, setName, check] = useName("");

  async function pick(option) {
    setError(null);
    setBusy(option.id);
    try {
      await tong.connect(option);
    } catch (e) {
      setError(/rejected|denied|4001/i.test(e.message) ? "You closed the request in your wallet." : e.message);
    } finally {
      setBusy(null);
    }
  }
  async function create() {
    setError(null);
    try {
      await tong.link(name);
    } catch (e) {
      setError(e.message);
    }
  }
  const detectedNames = new Set([...detected.evm, ...detected.solana].map((w) => w.name));
  const task = tong.task?.action === "link" ? tong.task : null;

  return (
    <div className="connect-page">
      <header className="c-top">
        <a href="#/" className="brand-link">
          <Logo />
        </a>
        <a href="#/" className="icon-btn" aria-label="Close">
          <X size={18} />
        </a>
      </header>
      <div className="c-modal">
        {!connected ? (
          <section className="c-pane c-list" aria-labelledby="c-title">
            <h1 id="c-title">Connect a wallet</h1>
            <p className="muted">Use the wallet you already have. Tong never sees your keys.</p>
            {detected.evm.length + detected.solana.length > 0 && (
              <div className="c-group">
                <h2>Detected in this browser</h2>
                {[...detected.evm, ...detected.solana].map((o) => (
                  <WalletRow key={o.id} option={o} onPick={pick} busy={busy} />
                ))}
              </div>
            )}
            <div className="c-group">
              <h2>Ethereum</h2>
              {INSTALL.evm
                .filter(([n]) => !detectedNames.has(n))
                .map(([name, href]) => (
                  <a key={name} className="wallet-row ghost" href={href} target="_blank" rel="noreferrer">
                    <span className="w-ico w-eth">
                      <EthMark />
                    </span>
                    <span className="wallet-name">
                      <strong>{name}</strong>
                      <small>Not installed</small>
                    </span>
                    <span className="chip">
                      Install <ExternalLink size={12} />
                    </span>
                  </a>
                ))}
            </div>
            <div className="c-group">
              <h2>Solana</h2>
              {INSTALL.solana
                .filter(([n]) => !detectedNames.has(n))
                .map(([name, href]) => (
                  <a key={name} className="wallet-row ghost" href={href} target="_blank" rel="noreferrer">
                    <span className="w-ico w-sol">
                      <SolMark />
                    </span>
                    <span className="wallet-name">
                      <strong>{name}</strong>
                      <small>Not installed</small>
                    </span>
                    <span className="chip">
                      Install <ExternalLink size={12} />
                    </span>
                  </a>
                ))}
            </div>
            <div className="c-group">
              <h2>Just exploring</h2>
              <button
                type="button"
                className="wallet-row"
                disabled={!!busy}
                onClick={() => pick({ id: "temporary", name: "Temporary test wallet", kind: "evm" })}
              >
                <span className="w-ico w-test">
                  <FlaskConical size={17} />
                </span>
                <span className="wallet-name">
                  <strong>Temporary test wallet</strong>
                  <small>New EVM key in this tab only · gone on reload</small>
                </span>
                {busy === "temporary" ? <Spinner /> : <ArrowRight size={16} />}
              </button>
            </div>
            {error && <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>}
          </section>
        ) : (
          <section className="c-pane c-list" aria-labelledby="c-title">
            <button type="button" className="link-btn back" onClick={() => tong.disconnect()}>
              <ArrowLeft size={15} /> Use another wallet
            </button>
            <h1 id="c-title">{linked ? "You're in." : "Create your NEAR account"}</h1>
            <p className="muted">
              {linked
                ? "This wallet already has a Tong account on NEAR."
                : "Pick a name. One signature creates a NEAR account that only your wallet can direct."}
            </p>
            <div className="c-identity">
              <div className="c-id-row">
                <span className={cx("w-ico", tong.activeEntry?.kind === "solana" ? "w-sol" : "w-eth")}>
                  {tong.activeEntry?.kind === "solana" ? <SolMark /> : <EthMark />}
                </span>
                <span>
                  <small>{tong.activeEntry?.name}</small>
                  <b>{walletLabel(tong.active)}</b>
                </span>
                <span className="chip chip-ok">
                  <Check size={12} /> Connected
                </span>
              </div>
              <div className="c-id-link" aria-hidden="true" />
              <div className="c-id-row">
                <span className="w-ico w-near">
                  <NearMark />
                </span>
                <span>
                  <small>Your NEAR account</small>
                  <b className="mono-b">{tong.identity?.account_id ?? (name ? `${name}.${CONTRACT_ID}` : `yourname.${CONTRACT_ID}`)}</b>
                </span>
                {linked ? (
                  <span className="chip chip-ok">Ready</span>
                ) : tong.identity === undefined ? (
                  <Spinner />
                ) : (
                  <span className="chip chip-warm">Not created</span>
                )}
              </div>
            </div>
            {!linked ? (
              <>
                <label className="field-label" htmlFor="c-name">
                  Pick your NEAR name
                </label>
                <div className={cx("name-field", check.state)}>
                  <input
                    id="c-name"
                    value={name}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="yourname"
                    maxLength={32}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  />
                  <span className="name-suffix">.{CONTRACT_ID}</span>
                </div>
                <p className={cx("name-check", check.state)} aria-live="polite">
                  {check.state === "checking" ? "Checking on NEAR…" : check.state === "ok" ? <><Check size={13} /> {`${name}.${CONTRACT_ID} is available`}</> : check.text ?? "A readable account, like an ENS name. Yours alone."}
                </p>
                <dl className="c-terms">
                  <div>
                    <dt>You sign</dt>
                    <dd>action “link”, your name, nonce 0, expires in 4 min</dd>
                  </div>
                  <div>
                    <dt>Account storage</dt>
                    <dd>{formatNear(tong.fees.link, 2)} test NEAR · paid by the Tong sponsor (0.45 NEAR starts in your account)</dd>
                  </div>
                  <div>
                    <dt>Keys on the account</dt>
                    <dd>None. Only the locked Tong contract can call it.</dd>
                  </div>
                </dl>
                {task && !task.error && <Steps current={task.phase} steps={LINK_STEPS} />}
                <button type="button" className="btn btn-dark btn-block btn-lg" onClick={create} disabled={(!!task && !task.error && task.phase !== "done") || check.state !== "ok"}>
                  {task && !task.error && task.phase !== "done" ? <Spinner /> : <ShieldCheck size={18} />}
                  {task && !task.error && task.phase !== "done" ? tong.phases[task.phase] + "…" : name && check.state === "ok" ? `Sign & create ${name}` : "Sign & create account"}
                </button>
              </>
            ) : (
              <>
                {task?.phase === "done" && (
                  <a className="receipt" href={nearTx(task.result.txHash)} target="_blank" rel="noreferrer">
                    <Check size={15} /> Account created on NEAR · {task.result.txHash.slice(0, 8)}… <ExternalLink size={13} />
                  </a>
                )}
                <a className="btn btn-dark btn-block btn-lg" href="#/app">
                  Open your account <ArrowRight size={18} />
                </a>
              </>
            )}
            {error && <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>}
          </section>
        )}
        <aside className="c-pane c-side">
          <img src={linked ? "/art/v2/two-keys.webp" : "/art/v2/plug-socket.webp"} alt="" />
          <h2>{linked ? "Linked." : "Your wallet, on NEAR."}</h2>
          <ul>
            <li>
              <b>Sign once per action.</b> Your wallet approves each thing Tong does.
            </li>
            <li>
              <b>Act on NEAR.</b> The contract checks your signature on chain.
            </li>
            <li>
              <b>Reach Ethereum.</b> Chain Signatures signs for your NEAR account.
            </li>
          </ul>
          <p className="fine">
            Contract <Ext href={`https://testnet.nearblocks.io/address/${CONTRACT_ID}`}>{CONTRACT_ID}</Ext> on NEAR testnet.
          </p>
        </aside>
      </div>
    </div>
  );
}

export const LINK_STEPS = [
  { key: "prepare", label: "Prepare request", hint: "Nonce and deadline from NEAR" },
  { key: "wallet", label: "Sign in your wallet", hint: "EIP-712 or ed25519" },
  { key: "relay", label: "Verify and create on NEAR", hint: "Factory checks the signature" },
];
