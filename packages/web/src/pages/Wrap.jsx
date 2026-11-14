import React, { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Check, ShieldAlert, ShieldCheck } from "lucide-react";
import { parseNear } from "@tong/sdk";
import { useTongApp } from "../lib/tong.jsx";
import { CONTRACT_ID, WRAP, formatNear, grantFor, policyToday, shortAccount, walletLabel, nearAccount } from "../lib/chain.js";
import { NeedWallet } from "../components/Shell.jsx";
import { Ext, Meter, Outcome, Spinner, Status, Steps, ErrorNote, cx } from "../components/ui.jsx";
import { ACT_STEPS } from "./Act.jsx";

const nearFmt = (v) => `${formatNear(v, 3)} NEAR`;

function Bal({ label, value }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (prev.current != null && value != null && prev.current !== value) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 700);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return (
    <div>
      <small>{label}</small>
      <b className={cx(bump && "bump")}>{value == null ? "…" : formatNear(value, 4)}</b>
    </div>
  );
}

export default function Wrap() {
  const tong = useTongApp();
  const [mode, setMode] = useState("wrap");
  const [amount, setAmount] = useState("0.1");
  const [error, setError] = useState(null);
  const policy = tong.identity?.policy;
  const grant = grantFor(policy, WRAP);
  const today = policyToday(policy);
  const task = tong.task?.action === "call" && /^(Wrap|Unwrap) /.test(tong.task?.label ?? "") ? tong.task : null;
  const working = task && !task.error && !["done", "refused"].includes(task.phase);
  let yocto = null;
  try {
    yocto = parseNear(amount);
  } catch {
    yocto = null;
  }
  const method = mode === "wrap" ? "near_deposit" : "near_withdraw";
  const deposit = mode === "wrap" ? yocto : 1n;
  const overCall = mode === "wrap" && grant && yocto != null && yocto > BigInt(grant.max_deposit);
  const overDay = mode === "wrap" && today && yocto != null && yocto > today.left;
  const over = overCall || overDay;
  const free = tong.account ? BigInt(tong.account.amount) - BigInt(tong.account.storage_usage) * 10n ** 19n : null;

  async function submit() {
    setError(null);
    try {
      const label = mode === "wrap" ? `Wrap ${amount} NEAR` : `Unwrap ${amount} wNEAR`;
      await tong.callApp(WRAP, method, mode === "wrap" ? {} : { amount: String(yocto) }, String(deposit), label);
    } catch (e) {
      if (!e.refused) setError(e.message);
    }
  }
  return (
    <NeedWallet>
      <div className="act-grid">
        <section className="card act-compose">
          <div className="app-chip">
            <span className="app-mono tone-ink">W</span>
            <span>
              <b>Wrapped NEAR</b>
              <small>
                <Ext href={nearAccount(WRAP)}>{WRAP}</Ext> · the wNEAR token NEAR DeFi uses
              </small>
            </span>
            {grant ? grant.expired ? <Status tone="bad">Expired</Status> : <Status tone="ok">Allowed</Status> : <Status tone="bad">No permission</Status>}
          </div>
          <div className="seg" role="tablist" style={{ marginBottom: 14 }}>
            {[
              ["wrap", "Wrap NEAR"],
              ["unwrap", "Unwrap"],
            ].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} className={cx(mode === k && "on")} onClick={() => setMode(k)} disabled={working}>
                {l}
              </button>
            ))}
          </div>
          <label htmlFor="amt" className="field-label">
            {mode === "wrap" ? "NEAR to wrap" : "wNEAR to unwrap"}
          </label>
          <div className="amount-row">
            <input id="amt" inputMode="decimal" value={amount} disabled={working} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
            <span className="amount-unit">{mode === "wrap" ? "NEAR" : "wNEAR"}</span>
          </div>
          <div className="quick">
            {["0.05", "0.1", "0.2", "0.5"].map((v) => (
              <button key={v} type="button" className={cx(amount === v && "on")} onClick={() => setAmount(v)} disabled={working}>
                {v}
              </button>
            ))}
          </div>
          {mode === "wrap" && grant && yocto != null && (
            <div className={cx("policy-hint", over && "over")}>
              {over ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
              <span>
                {overCall
                  ? `${amount} NEAR is over your ${nearFmt(grant.max_deposit)} per-call limit for ${WRAP}. The Tong contract will refuse it on chain.`
                  : overDay
                    ? `${amount} NEAR would pass today's ${nearFmt(today.cap)} allowance (${nearFmt(today.spent)} used). The contract will refuse it.`
                    : `Within your limits: ${nearFmt(grant.max_deposit)} per call, ${nearFmt(today.left)} left today.`}
              </span>
            </div>
          )}
          {task && !task.error && task.phase !== "refused" && <Steps steps={ACT_STEPS} current={task.phase} />}
          <button type="button" className={cx("btn btn-lg btn-block", over ? "btn-coral" : "btn-dark")} disabled={working || yocto == null || yocto === 0n || !tong.canSign} onClick={submit}>
            {working ? <Spinner /> : <ArrowDownUp size={18} />}
            {working ? tong.phases[task.phase] + "…" : over ? "Sign anyway: let NEAR decide" : mode === "wrap" ? `Sign & wrap ${amount} NEAR` : `Sign & unwrap ${amount} wNEAR`}
          </button>
          {!tong.canSign && <p className="muted small">Reconnect {walletLabel(tong.active)} to sign.</p>}
          {error && <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>}
          <Outcome task={task} title={(task?.label ?? "").replace(/^Wrap /, "Wrapped ").replace(/^Unwrap /, "Unwrapped ")}>
            <p>
              wNEAR balance read back from {WRAP}: <b>{tong.wnear == null ? "…" : formatNear(tong.wnear, 4)}</b>
            </p>
          </Outcome>
        </section>
        <section className="card sign-preview">
          <div className="card-head">
            <h3>Your balances</h3>
            <span className="chip">Live from NEAR RPC</span>
          </div>
          <div className="bal-pair">
            <Bal label="NEAR (spendable)" value={free == null ? null : String(free)} />
            <Bal label="wNEAR" value={tong.wnear} />
          </div>
          {today && grant && (
            <>
              <Meter label="Spent today (all apps and sends)" value={today.spent} max={today.cap} fmt={nearFmt} tone={today.left < 10n ** 23n ? "warm" : undefined} />
              <dl className="kv">
                <div>
                  <dt>per-call limit</dt>
                  <dd>{nearFmt(grant.max_deposit)}</dd>
                </div>
                <div>
                  <dt>methods</dt>
                  <dd className="mono">{grant.methods.join(", ")}</dd>
                </div>
                <div>
                  <dt>permission ends</dt>
                  <dd>{new Date(Number(grant.expires_at) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</dd>
                </div>
              </dl>
            </>
          )}
          <div className="card-head" style={{ marginTop: 14 }}>
            <h3>What your wallet signs</h3>
          </div>
          <dl className="kv">
            <div>
              <dt>action</dt>
              <dd className="mono">call</dd>
            </div>
            <div>
              <dt>data</dt>
              <dd className="mono wrap">{JSON.stringify({ contract: WRAP, method, deposit: deposit == null ? "?" : String(deposit) })}</dd>
            </div>
          </dl>
          <div className="exec-box">
            <span>Runs as</span>
            <b className="mono">{shortAccount(tong.identity?.account_id)}</b>
            <span>calls</span>
            <b className="mono">
              {WRAP}.{method}
            </b>
          </div>
          {task?.signature && (
            <p className="sig-line">
              <Check size={13} /> Signature <span className="mono">{task.signature.slice(0, 18)}…</span>
            </p>
          )}
          <p className="card-foot">
            Limits live in <span className="mono">{CONTRACT_ID}</span>. The sponsor pays gas; the NEAR comes from your own account.
          </p>
        </section>
      </div>
    </NeedWallet>
  );
}
