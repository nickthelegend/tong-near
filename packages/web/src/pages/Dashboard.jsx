import React, { useEffect, useState } from "react";
import { PenLine, Globe2, LayoutGrid, History, ArrowRight, Plus, RefreshCw, KeyRound, Check } from "lucide-react";
import { useTongApp } from "../lib/tong.jsx";
import {
  formatNear,
  formatEth,
  nearAccount,
  sepoliaAddress,
  short,
  shortAccount,
  walletLabel,
  accessKeys,
  accountActivity,
  timeAgo,
  nearTx,
} from "../lib/chain.js";
import { Avatar, ChainIcon, CopyButton, Ext, NearMark, EthMark, Skeleton, Status, cx, ErrorNote } from "../components/ui.jsx";
import { NeedWallet } from "../components/Shell.jsx";

function useKeys(id) {
  const [keys, setKeys] = useState(undefined);
  useEffect(() => {
    if (!id) return;
    accessKeys(id)
      .then((k) => setKeys(k.length))
      .catch(() => setKeys(null));
  }, [id]);
  return keys;
}
function useRecent(id, bump) {
  const [rows, setRows] = useState(undefined);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!id) return;
    accountActivity(id)
      .then((r) => setRows(r.slice(0, 4)))
      .catch((e) => setErr(e.message));
  }, [id, bump]);
  return { rows, err };
}

export default function Dashboard() {
  const tong = useTongApp();
  const id = tong.identity;
  const keys = useKeys(id?.account_id);
  const recent = useRecent(id?.ready ? id.account_id : null, tong.activity.length);
  return (
    <NeedWallet>
      {tong.readError && <ErrorNote>{tong.readError}</ErrorNote>}
      <div className="dash-grid">
        <section className="hero-card">
          <div className="hc-top">
            <Avatar seed={tong.active} size={44} />
            <div>
              <small>NEAR account for {walletLabel(tong.active)}</small>
              <h2 className="hc-id">
                {id ? shortAccount(id.account_id) : <Skeleton w={260} h={26} />}
                {id && <CopyButton text={id.account_id} label="Copy NEAR account" />}
              </h2>
            </div>
            <button type="button" className="icon-btn on-dark" onClick={() => tong.refresh()} aria-label="Refresh">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="hc-balance">
            <span className="big">{tong.account ? formatNear(tong.account.amount, 3) : <Skeleton w={140} h={52} />}</span>
            <span className="unit">NEAR</span>
          </div>
          <div className="hc-meta">
            <span>
              <i className="dot dot-ok" /> {id?.ready ? "Ready" : "Creating"}
            </span>
            <span>{keys === undefined ? "…" : keys === null ? "—" : keys} access keys</span>
            <span>{id ? `${id.nonce} signed actions` : "…"}</span>
            {id && <Ext href={nearAccount(id.account_id)}>NearBlocks</Ext>}
          </div>
          <div className="hc-actions">
            <a href="#/app/act">
              <span>
                <PenLine size={19} />
              </span>
              Act
            </a>
            <a href="#/app/sign">
              <span>
                <Globe2 size={19} />
              </span>
              Sign
            </a>
            <a href="#/app/apps">
              <span>
                <LayoutGrid size={19} />
              </span>
              Apps
            </a>
            <a href="#/app/activity">
              <span>
                <History size={19} />
              </span>
              Activity
            </a>
          </div>
          {!tong.canSign && <p className="hc-warn">Read-only: reconnect {walletLabel(tong.active)} to sign.</p>}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Linked wallets</h3>
            <a className="btn btn-ghost btn-sm" href="#/connect">
              <Plus size={14} /> Add
            </a>
          </div>
          <ul className="list">
            {tong.wallets.map((w) => (
              <li key={w.wallet} className={cx("list-row", w.wallet === tong.active && "on")}>
                <span className={cx("w-ico", w.kind === "solana" ? "w-sol" : "w-eth")}>
                  <ChainIcon kind={w.kind} />
                </span>
                <span className="grow">
                  <b>{walletLabel(w.wallet)}</b>
                  <small>
                    {w.name}
                    {w.temporary ? " · this tab only" : ""}
                  </small>
                </span>
                {w.wallet === tong.sessionWallet ? (
                  <Status tone="ok">Can sign</Status>
                ) : w.wallet === tong.active ? (
                  <Status>Viewing</Status>
                ) : (
                  <button type="button" className="link-btn" onClick={() => tong.switchTo(w.wallet)}>
                    View
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="card-foot">Each wallet gets its own NEAR account. Nothing links them on chain.</p>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Your addresses</h3>
          </div>
          <ul className="list">
            <li className="list-row">
              <span className="w-ico w-near">
                <NearMark />
              </span>
              <span className="grow">
                <b>NEAR testnet</b>
                <small className="mono">{id ? shortAccount(id.account_id) : "…"}</small>
              </span>
              <span className="num">{tong.account ? `${formatNear(tong.account.amount, 3)} NEAR` : "…"}</span>
            </li>
            <li className="list-row">
              <span className="w-ico w-eth">
                <EthMark />
              </span>
              <span className="grow">
                <b>Sepolia · via Chain Signatures</b>
                <small className="mono">
                  {tong.derived ? (
                    <a href={sepoliaAddress(tong.derived)} target="_blank" rel="noreferrer">
                      {short(tong.derived, 6, 4)}
                    </a>
                  ) : (
                    "Deriving…"
                  )}
                </small>
              </span>
              <span className="num">{tong.eth?.balance !== undefined ? `${formatEth(tong.eth.balance)} ETH` : tong.eth?.error ? "—" : "…"}</span>
            </li>
          </ul>
          <a className="card-cta" href="#/app/sign">
            Sign a Sepolia transfer <ArrowRight size={15} />
          </a>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>On-chain note</h3>
            <a className="link-btn" href="#/app/act">
              Edit
            </a>
          </div>
          {tong.state ? (
            tong.state.note ? (
              <blockquote className="note-quote">“{tong.state.note}”</blockquote>
            ) : (
              <p className="muted">No note yet. Write one with your wallet.</p>
            )
          ) : (
            <Skeleton h={40} />
          )}
          <p className="card-foot">Stored in your NEAR account's own contract state.</p>
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h3>Recent activity</h3>
            <a className="link-btn" href="#/app/activity">
              See all
            </a>
          </div>
          {recent.err ? (
            <p className="muted">{recent.err}</p>
          ) : recent.rows === undefined ? (
            <Skeleton h={60} />
          ) : recent.rows.length === 0 ? (
            <p className="muted">Nothing indexed yet. New transactions appear within a minute.</p>
          ) : (
            <ul className="list">
              {recent.rows.map((r) => (
                <li key={r.hash} className="list-row">
                  <span className={cx("act-ico", `act-${r.kind}`)}>
                    {r.kind === "link" ? <KeyRound size={15} /> : r.kind === "note" ? <PenLine size={15} /> : r.kind === "signature" ? <Globe2 size={15} /> : <Check size={15} />}
                  </span>
                  <span className="grow">
                    <b>{r.label}</b>
                    <small>{timeAgo(r.at)}</small>
                  </span>
                  <Ext href={nearTx(r.hash)}>{short(r.hash, 6, 4)}</Ext>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </NeedWallet>
  );
}
