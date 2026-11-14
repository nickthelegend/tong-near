import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { TongConnector } from "@tong/sdk";
import { CONTRACT_ID, GUESTBOOK, guestbookLatest, grantFor, nearAccount, nearTx, walletLabel } from "../lib/chain.js";

// A tiny third-party dApp: the NEAR Guestbook (near-examples), driven only through @tong/sdk.
// It does not use the Tong app's own state; the code panel shows the exact calls it makes.
const CODE = [
  ['import { TongConnector } from "@tong/sdk";', null],
  ["", null],
  [`const tong = new TongConnector({ contractId: "${CONTRACT_ID}", evmProvider });`, null],
  ['await tong.connect("evm");', "connect"],
  [`await tong.grant("${GUESTBOOK}",`, "grant"],
  ['  ["add_message"], "0", 7);  // 7 days, no deposit', "grant"],
  [`await tong.call("${GUESTBOOK}",`, "post"],
  ['  "add_message", { text });', "post"],
];

function useEip6963() {
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    const seen = new Set();
    const on = (e) => {
      const d = e.detail;
      if (!d?.info || seen.has(d.info.uuid)) return;
      seen.add(d.info.uuid);
      setProviders((p) => [...p, d]);
    };
    window.addEventListener("eip6963:announceProvider", on);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", on);
  }, []);
  return providers;
}

export default function Demo() {
  const providers = useEip6963();
  const tong = useRef(null);
  const [me, setMe] = useState(null);
  const [step, setStep] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState("Hello NEAR, from my Ethereum wallet via Tong");
  const [book, setBook] = useState(null);
  const [last, setLast] = useState({});
  const load = () =>
    guestbookLatest(6)
      .then(setBook)
      .catch((e) => setBook({ error: e.message }));
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function connect(p) {
    setError(null);
    setBusy("connect");
    setStep("connect");
    try {
      const evmProvider = p?.provider ?? window.ethereum;
      if (!evmProvider) throw new Error("No Ethereum wallet found. Install MetaMask or Rabby.");
      tong.current = new TongConnector({ contractId: CONTRACT_ID, evmProvider });
      const { wallet, identity } = await tong.current.connect("evm");
      setMe({ wallet, identity, name: p?.info?.name ?? "Wallet" });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function act(kind, fn) {
    setError(null);
    setBusy(kind);
    setStep(kind);
    try {
      const out = await fn();
      setLast((l) => ({ ...l, [kind]: out.txHash }));
      setMe((m) => ({ ...m, identity: tong.current.identity }));
      await load();
    } catch (e) {
      setError(e.refused ? `Refused on chain: ${e.message}` : e.message);
      if (e.txHash) setLast((l) => ({ ...l, [kind]: e.txHash }));
      setMe((m) => (m ? { ...m, identity: tong.current.identity } : m));
    } finally {
      setBusy(null);
    }
  }
  const grant = grantFor(me?.identity?.policy, GUESTBOOK);
  const allowed = grant && !grant.expired;
  const spin = <LoaderCircle size={16} className="spin" />;

  return (
    <div className="demo">
      <header className="demo-top">
        <a href="#/app/developers" className="demo-back">
          <ArrowLeft size={15} /> Tong developers
        </a>
        <span className="demo-brand">
          <BookOpen size={18} /> NEAR Guestbook
        </span>
        <span className="demo-tag">Demo dApp · built with @tong/sdk</span>
      </header>
      <main className="demo-main">
        <section className="demo-app">
          <div className="demo-hero">
            <h1>Sign the guestbook.</h1>
            <p>
              A real NEAR testnet app (<a href={nearAccount(GUESTBOOK)} target="_blank" rel="noreferrer">{GUESTBOOK}</a>). Bring your
              Ethereum wallet. No NEAR wallet, no gas.
            </p>
          </div>
          {!me ? (
            <div className="demo-card">
              <h2>1. Connect</h2>
              {providers.length === 0 && <p className="demo-muted">Looking for wallets in this browser…</p>}
              {providers.map((p) => (
                <button key={p.info.uuid} type="button" className="demo-btn" onClick={() => connect(p)} disabled={!!busy}>
                  <img src={p.info.icon} alt="" width="22" height="22" /> Continue with {p.info.name}
                  {busy === "connect" && spin}
                </button>
              ))}
            </div>
          ) : !me.identity?.ready ? (
            <div className="demo-card">
              <h2>No NEAR account yet</h2>
              <p className="demo-muted">{walletLabel(me.wallet)} has no Tong account. Create one in one signature, then come back.</p>
              <a className="demo-btn" href="#/connect">
                Create a Tong account <ArrowUpRight size={15} />
              </a>
            </div>
          ) : (
            <>
              <div className="demo-who">
                <span className="demo-dot" />
                <span>
                  <b>{me.identity.account_id}</b>
                  <small>
                    signed in with {me.name} · {walletLabel(me.wallet)}
                  </small>
                </span>
              </div>
              <div className={allowed ? "demo-card done" : "demo-card"}>
                <h2>2. Allow posting {allowed && <Check size={18} />}</h2>
                {allowed ? (
                  <p className="demo-muted">
                    Allowed: <span className="mono">add_message</span>, no deposit, until{" "}
                    {new Date(Number(grant.expires_at) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Stored on chain in your
                    Tong policy.
                    {last.grant && (
                      <a href={nearTx(last.grant)} target="_blank" rel="noreferrer">
                        {" "}
                        Receipt <ArrowUpRight size={12} />
                      </a>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="demo-muted">This app asks your account for one permission: post messages, no NEAR attached, for 7 days.</p>
                    <button type="button" className="demo-btn" disabled={!!busy} onClick={() => act("grant", () => tong.current.grant(GUESTBOOK, ["add_message"], "0", 7))}>
                      <ShieldCheck size={16} /> Allow for 7 days {busy === "grant" && spin}
                    </button>
                  </>
                )}
              </div>
              <div className="demo-card">
                <h2>3. Write your message</h2>
                <textarea rows={3} maxLength={140} value={text} onChange={(e) => setText(e.target.value)} disabled={!!busy} />
                <button type="button" className="demo-btn" disabled={!!busy || !text.trim()} onClick={() => act("post", () => tong.current.call(GUESTBOOK, "add_message", { text: text.trim() }, "0"))}>
                  <Send size={16} /> Sign & post {busy === "post" && spin}
                </button>
                {last.post && !error && (
                  <p className="demo-ok">
                    <Check size={14} /> Posted on NEAR ·{" "}
                    <a href={nearTx(last.post)} target="_blank" rel="noreferrer">
                      {last.post.slice(0, 10)}… <ArrowUpRight size={12} />
                    </a>
                  </p>
                )}
              </div>
            </>
          )}
          {error && (
            <p className="demo-err" role="alert">
              {error}
              {last[step] && (
                <a href={nearTx(last[step])} target="_blank" rel="noreferrer">
                  {" "}
                  receipt <ArrowUpRight size={12} />
                </a>
              )}
            </p>
          )}
          <div className="demo-book">
            <h2>
              Latest messages <small>{book?.total ? `${book.total.toLocaleString("en-US")} total · live from the contract` : ""}</small>
            </h2>
            {book?.error ? (
              <p className="demo-err">{book.error}</p>
            ) : !book ? (
              <p className="demo-muted">Loading…</p>
            ) : (
              <ul>
                {book.rows.map((m) => (
                  <li key={m.index} className={me?.identity && m.sender === me.identity.account_id ? "mine" : ""}>
                    <b>{m.sender}</b>
                    <span>{m.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <aside className="demo-code">
          <div className="demo-code-head">
            <span>guestbook.js</span>
            <small>the whole integration</small>
          </div>
          <pre>
            {CODE.map(([line, k], i) => (
              <code key={i} className={k && k === step ? (busy === k ? "run" : "hit") : ""}>
                <i>{i + 1}</i>
                {line || " "}
              </code>
            ))}
          </pre>
          <ul className="demo-notes">
            <li>The wallet signs typed data. Tong's relayer pays the gas.</li>
            <li>The grant and every call are checked on chain by {CONTRACT_ID}.</li>
            <li>Calls outside the grant are refused by the contract, not by this app.</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
