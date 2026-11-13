import React, { useEffect, useState } from "react";
import { Check, ExternalLink, PenLine, ShieldCheck } from "lucide-react";
import { useTongApp } from "../lib/tong.jsx";
import { CONTRACT_ID, nearTx, shortAccount, walletLabel } from "../lib/chain.js";
import { NeedWallet } from "../components/Shell.jsx";
import { Spinner, Steps, ErrorNote, Status } from "../components/ui.jsx";

const enc = new TextEncoder();
export const ACT_STEPS = [
  { key: "prepare", label: "Prepare", hint: "Live nonce from the contract" },
  { key: "wallet", label: "Sign in your wallet", hint: "Typed data, no gas" },
  { key: "relay", label: "Verify on NEAR", hint: "Factory checks signature and nonce" },
];

function Countdown({ deadline }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Number(deadline) - Math.floor(now / 1000));
  return (
    <span className="mono">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

export default function Act() {
  const tong = useTongApp();
  const [note, setNote] = useState("gm NEAR — signed from my Ethereum wallet.");
  const [error, setError] = useState(null);
  const bytes = enc.encode(note).length;
  const task = tong.task?.action === "set_note" ? tong.task : null;
  const working = task && !task.error && task.phase !== "done";
  const nonce = tong.identity?.nonce ?? "…";

  async function submit() {
    setError(null);
    try {
      await tong.setNote(note.trim());
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <NeedWallet>
      <div className="act-grid">
        <section className="card act-compose">
          <div className="app-chip">
            <span className="app-mono">N</span>
            <span>
              <b>Tong Notes</b>
              <small>Write to your NEAR account's state</small>
            </span>
            <Status tone="ok">Allowed</Status>
          </div>
          <label htmlFor="note" className="field-label">
            Note
          </label>
          <textarea
            id="note"
            rows={4}
            value={note}
            maxLength={256}
            disabled={working}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="field-meta">
            <span>{bytes}/256 bytes</span>
            <span>No gas from you · no deposit</span>
          </div>
          {task && !task.error && <Steps steps={ACT_STEPS} current={task.phase} />}
          <button type="button" className="btn btn-dark btn-lg btn-block" disabled={working || !note.trim() || bytes > 256 || !tong.canSign} onClick={submit}>
            {working ? <Spinner /> : <PenLine size={18} />}
            {working ? tong.phases[task.phase] + "…" : "Sign & save on NEAR"}
          </button>
          {!tong.canSign && <p className="muted small">Reconnect {walletLabel(tong.active)} to sign.</p>}
          {(error || task?.error) && <ErrorNote onClose={() => { setError(null); tong.clearTask(); }}>{error || task.error}</ErrorNote>}
          {task?.phase === "done" && (
            <div className="success-card">
              <img src="/art/3d/success-check.webp" alt="" width="64" height="64" />
              <div>
                <b>Saved on NEAR</b>
                <p>Read back from your account: “{tong.state?.note}”</p>
                <a href={nearTx(task.result.txHash)} target="_blank" rel="noreferrer" className="ext">
                  {task.result.txHash} <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </section>
        <section className="card sign-preview">
          <div className="card-head">
            <h3>What your wallet signs</h3>
            <span className="chip">
              <ShieldCheck size={12} /> EIP-712
            </span>
          </div>
          <dl className="kv">
            <div>
              <dt>domain</dt>
              <dd className="mono">near:testnet:{CONTRACT_ID}</dd>
            </div>
            <div>
              <dt>wallet</dt>
              <dd className="mono">{walletLabel(tong.active)}</dd>
            </div>
            <div>
              <dt>action</dt>
              <dd className="mono">set_note</dd>
            </div>
            <div>
              <dt>data</dt>
              <dd className="mono wrap">{JSON.stringify({ note: note.trim() })}</dd>
            </div>
            <div>
              <dt>nonce</dt>
              <dd className="mono">{task?.request?.nonce ?? nonce}</dd>
            </div>
            <div>
              <dt>expires</dt>
              <dd>{task?.request ? <Countdown deadline={task.request.deadline} /> : "4:00 after you press sign"}</dd>
            </div>
          </dl>
          <div className="exec-box">
            <span>Runs as</span>
            <b className="mono">{shortAccount(tong.identity?.account_id)}</b>
            <span>calls</span>
            <b className="mono">set_note</b>
          </div>
          {task?.signature && (
            <p className="sig-line">
              <Check size={13} /> Signature <span className="mono">{task.signature.slice(0, 18)}…</span>
            </p>
          )}
        </section>
      </div>
    </NeedWallet>
  );
}
