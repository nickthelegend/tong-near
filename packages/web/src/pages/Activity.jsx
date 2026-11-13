import React, { useCallback, useEffect, useState } from "react";
import { Check, Globe2, KeyRound, PenLine, Radio, RefreshCw, X } from "lucide-react";
import { useTongApp } from "../lib/tong.jsx";
import { accountActivity, nearTx, sepoliaTx, short, shortAccount, timeAgo, nearAccount, txReceipt, formatNear } from "../lib/chain.js";
import { NeedWallet } from "../components/Shell.jsx";
import { Empty, Ext, Skeleton, Status, cx, ErrorNote, Spinner } from "../components/ui.jsx";

const ICON = { link: KeyRound, note: PenLine, signature: Globe2, broadcast: Radio, transfer: Check };
const FILTERS = [
  ["all", "All"],
  ["link", "Account"],
  ["note", "Notes"],
  ["signature", "Signatures"],
];

function Receipt({ row, onClose }) {
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setR(null);
    setErr(null);
    txReceipt(row.hash).then(setR).catch((e) => setErr(e.message));
  }, [row.hash]);
  return (
    <aside className="drawer" aria-label="Transaction receipt">
      <div className="card-head">
        <h3>{row.label}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close receipt">
          <X size={16} />
        </button>
      </div>
      <p className="mono small muted wrap">{row.hash}</p>
      {err ? (
        <ErrorNote>{err}</ErrorNote>
      ) : !r ? (
        <p className="muted drawer-load">
          <Spinner /> Reading the receipt from NEAR RPC…
        </p>
      ) : (
        <>
          <div className={cx("drawer-status", r.ok ? "ok" : "bad")}>
            {r.ok ? <Check size={16} /> : <X size={16} />} {r.ok ? "Final · success" : "Failed"} · {r.receipts} receipts
          </div>
          <dl className="kv">
            <div>
              <dt>Paid by</dt>
              <dd className="mono">{r.signer}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd className="mono">
                {r.receiver}.{r.method}()
              </dd>
            </div>
            {r.event && (
              <>
                <div>
                  <dt>Your wallet</dt>
                  <dd className="mono">{short(r.event.wallet.replace(/^evm:|^solana:/, ""), 8, 6)}</dd>
                </div>
                <div>
                  <dt>Acted as</dt>
                  <dd className="mono">{shortAccount(r.event.account_id)}</dd>
                </div>
                <div>
                  <dt>Action</dt>
                  <dd className="mono">
                    {r.event.action} · nonce {r.event.nonce}
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt>Deposit</dt>
              <dd>{formatNear(r.deposit, 3)} NEAR</dd>
            </div>
            <div>
              <dt>Gas burnt</dt>
              <dd>
                {(Number(r.gas) / 1e12).toFixed(1)} Tgas · {formatNear(r.fee, 5)} NEAR
              </dd>
            </div>
            <div>
              <dt>Block</dt>
              <dd className="mono">{short(r.block, 8, 6)}</dd>
            </div>
          </dl>
          <a className="btn btn-dark btn-block" href={nearTx(row.hash)} target="_blank" rel="noreferrer">
            Open on NearBlocks
          </a>
        </>
      )}
    </aside>
  );
}

export default function Activity() {
  const tong = useTongApp();
  const id = tong.identity?.ready ? tong.identity.account_id : null;
  const [rows, setRows] = useState(undefined);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);
  const load = useCallback(() => {
    if (!id) return;
    setErr(null);
    accountActivity(id)
      .then(setRows)
      .catch((e) => {
        setErr(e.message);
        setRows((r) => r ?? []);
      });
  }, [id]);
  useEffect(load, [load, tong.activity.length]);

  // Session entries not yet indexed by NearBlocks, plus Sepolia broadcasts.
  const indexed = new Set((rows ?? []).map((r) => r.hash));
  const kindOf = { link: "link", set_note: "note", sign_sepolia: "signature", broadcast: "broadcast" };
  const pending = tong.activity
    .filter((a) => !indexed.has(a.hash))
    .map((a) => ({ hash: a.hash, at: a.at, ok: a.ok, label: a.label, kind: kindOf[a.kind] ?? a.kind, chain: a.chain, pending: a.chain !== "sepolia" }));
  const all = [...pending, ...(rows ?? [])].filter((r) => filter === "all" || r.kind === filter);

  return (
    <NeedWallet>
      <div className="apps-bar">
        <div className="seg" role="tablist">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={cx(filter === k && "on")} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {err && <ErrorNote>{err} Your session's own transactions are still listed.</ErrorNote>}
      <div className={cx("act-layout", open && "with-drawer")}>
      <section className="card table-card">
        {rows === undefined ? (
          <div className="pad">
            <Skeleton h={18} />
            <br />
            <Skeleton h={18} />
            <br />
            <Skeleton h={18} w="70%" />
          </div>
        ) : all.length === 0 ? (
          <Empty art="/art/v2/empty.webp" title="No activity yet">
            Create your account or save a note and it shows up here with its NEAR receipt.
          </Empty>
        ) : (
          <table className="tx-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Status</th>
                <th>Chain</th>
                <th>Transaction</th>
                <th className="r">When</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => {
                const Icon = ICON[r.kind] ?? Check;
                const sep = r.chain === "sepolia";
                return (
                  <tr key={r.hash} className={cx("tx-row", open?.hash === r.hash && "on")} onClick={() => !sep && setOpen(r)}>
                    <td>
                      <span className="tx-act">
                        <span className={cx("act-ico", `act-${r.kind}`)}>
                          <Icon size={15} />
                        </span>
                        <b>{r.label}</b>
                      </span>
                    </td>
                    <td>{r.ok ? r.pending ? <Status tone="warm">Indexing</Status> : <Status tone="ok">Success</Status> : <Status tone="bad"><X size={11} /> Failed</Status>}</td>
                    <td>{sep ? "Sepolia" : "NEAR testnet"}</td>
                    <td>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Ext href={sep ? sepoliaTx(r.hash) : nearTx(r.hash)}>{short(r.hash, 8, 6)}</Ext>
                      </span>
                    </td>
                    <td className="r muted">{timeAgo(r.at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {open && <Receipt row={open} onClose={() => setOpen(null)} />}
      </div>
      {id && (
        <p className="muted small center">
          Indexed by NearBlocks for <Ext href={nearAccount(id)}>{short(id, 8, 22)}</Ext>
        </p>
      )}
    </NeedWallet>
  );
}
