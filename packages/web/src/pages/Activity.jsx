import React, { useCallback, useEffect, useState } from "react";
import { Check, Globe2, KeyRound, PenLine, Radio, RefreshCw, X } from "lucide-react";
import { useTongApp } from "../lib/tong.jsx";
import { accountActivity, nearTx, sepoliaTx, short, timeAgo, nearAccount } from "../lib/chain.js";
import { NeedWallet } from "../components/Shell.jsx";
import { Empty, Ext, Skeleton, Status, cx, ErrorNote } from "../components/ui.jsx";

const ICON = { link: KeyRound, note: PenLine, signature: Globe2, broadcast: Radio, transfer: Check };
const FILTERS = [
  ["all", "All"],
  ["link", "Account"],
  ["note", "Notes"],
  ["signature", "Signatures"],
];

export default function Activity() {
  const tong = useTongApp();
  const id = tong.identity?.ready ? tong.identity.account_id : null;
  const [rows, setRows] = useState(undefined);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("all");
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
          <Empty art="/art/3d/globe-nodes.webp" title="No activity yet">
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
                  <tr key={r.hash}>
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
                      <Ext href={sep ? sepoliaTx(r.hash) : nearTx(r.hash)}>{short(r.hash, 8, 6)}</Ext>
                    </td>
                    <td className="r muted">{timeAgo(r.at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      {id && (
        <p className="muted small center">
          Indexed by NearBlocks for <Ext href={nearAccount(id)}>{short(id, 8, 22)}</Ext>
        </p>
      )}
    </NeedWallet>
  );
}
