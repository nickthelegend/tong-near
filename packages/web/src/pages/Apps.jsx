import React, { useState } from "react";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { useTongApp } from "../lib/tong.jsx";
import { nearAccount, CONTRACT_ID } from "../lib/chain.js";
import { Spinner, Status, cx } from "../components/ui.jsx";

const LIVE = [
  { name: "Tong Notes", cat: "Profile", tone: "coral", desc: "Write a signed note to your NEAR account. The note lives in your account's own state.", does: "set_note · up to 256 bytes", href: "#/app/act", cta: "Open" },
  { name: "Chain Signatures", cat: "Cross-chain", tone: "ink", desc: "NEAR's MPC network signs Sepolia transfers from an address your account owns.", does: "sign_sepolia · ≤ 0.001 ETH", href: "#/app/sign", cta: "Open" },
  { name: "NEAR Intents 1Click", cat: "Bridge quote", tone: "sand", desc: "Price 10 USDC from Ethereum to NEAR on the live 1Click API. Dry quote: no deposit address, no funds move.", does: "read-only · mainnet dry quote", quote: true },
  { name: "NearBlocks", cat: "Explorer", tone: "pearl", desc: "Every receipt your NEAR account produces, verified by an independent explorer.", does: "read-only", explorer: true },
];
const ROADMAP = [
  { name: "Ref Finance", cat: "DEX", desc: "Swap on NEAR's largest AMM." },
  { name: "Burrow", cat: "Lending", desc: "Supply and borrow against NEAR assets." },
  { name: "Meta Pool", cat: "Staking", desc: "Liquid-stake NEAR for stNEAR." },
  { name: "Mintbase", cat: "NFTs", desc: "Mint and collect NFTs on NEAR." },
  { name: "NEAR Social", cat: "Social", desc: "Post and follow on chain." },
];

function Mono({ name, tone }) {
  return <span className={cx("app-mono", tone && `tone-${tone}`)}>{name[0]}</span>;
}

export default function Apps() {
  const tong = useTongApp();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [quote, setQuote] = useState(null);
  const match = (a) => !q || (a.name + a.cat).toLowerCase().includes(q.toLowerCase());

  async function getQuote() {
    setQuote({ busy: true });
    try {
      const r = await fetch("/api/quote");
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      setQuote(b);
    } catch (e) {
      setQuote({ error: e.message.includes("JSON") ? "Sponsor offline: start the relayer to proxy 1Click." : e.message });
    }
  }
  const out = quote?.result?.quote?.amountOutFormatted;
  return (
    <>
      <div className="apps-bar">
        <div className="seg" role="tablist">
          {[
            ["all", "All"],
            ["live", "Works now"],
            ["soon", "Roadmap"],
          ].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={cx(filter === k && "on")} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={15} />
          <input placeholder="Search apps" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {filter !== "soon" && (
        <>
          <h2 className="sec-title">Works with your wallet today</h2>
          <div className="apps-grid">
            {LIVE.filter(match).map((a) => (
              <article key={a.name} className="app-card">
                <div className="app-top">
                  <Mono name={a.name} tone={a.tone} />
                  <Status tone="ok">Live</Status>
                </div>
                <h3>{a.name}</h3>
                <small className="app-cat">{a.cat}</small>
                <p>{a.desc}</p>
                <code className="app-does">{a.does}</code>
                {a.quote && quote && !quote.busy && (
                  <div className={cx("quote-box", quote.error && "err")}>
                    {quote.error ? (
                      quote.error
                    ) : (
                      <>
                        10 USDC → <b>{out ? Number(out).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "?"} USDC</b> on NEAR
                        <small>Live quote · dry: true · {new Date(quote.at).toLocaleTimeString()}</small>
                      </>
                    )}
                  </div>
                )}
                <div className="app-foot">
                  {a.href && (
                    <a className="btn btn-dark btn-sm" href={a.href}>
                      {a.cta} <ArrowRight size={14} />
                    </a>
                  )}
                  {a.quote && (
                    <button type="button" className="btn btn-dark btn-sm" onClick={getQuote} disabled={quote?.busy}>
                      {quote?.busy ? <Spinner size={14} /> : null} Get live quote
                    </button>
                  )}
                  {a.explorer && (
                    <a className="btn btn-dark btn-sm" href={nearAccount(tong.identity?.account_id ?? CONTRACT_ID)} target="_blank" rel="noreferrer">
                      View my account <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {filter !== "live" && (
        <>
          <h2 className="sec-title">
            Next: any NEAR app <small>Needs Tong's app-call permission, not in the v1 policy yet.</small>
          </h2>
          <div className="apps-grid soon">
            {ROADMAP.filter(match).map((a) => (
              <article key={a.name} className="app-card muted-card">
                <div className="app-top">
                  <Mono name={a.name} />
                  <Status>Roadmap</Status>
                </div>
                <h3>{a.name}</h3>
                <small className="app-cat">{a.cat}</small>
                <p>{a.desc}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
