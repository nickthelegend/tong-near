import React, { useEffect, useState } from "react";
import { Check, KeyRound, Lock, TimerReset, X, Trash2 } from "lucide-react";
import { useTongApp } from "../lib/tong.jsx";
import { CONTRACT_ID, DEPLOYMENT, accessKeys, getConfig, formatNear, nearAccount, short, shortAccount, walletLabel, policyToday } from "../lib/chain.js";
import { Ext, Skeleton, Status, Meter, Outcome, Spinner } from "../components/ui.jsx";

const nearFmt = (v) => `${formatNear(v, 3)} NEAR`;
const until = (s) => {
  const days = Math.ceil((Number(s) * 1000 - Date.now()) / 86_400_000);
  return days <= 0 ? "expired" : `${days} day${days === 1 ? "" : "s"} left`;
};

function Policy() {
  const tong = useTongApp();
  const p = tong.identity?.policy;
  const today = policyToday(p);
  const task = ["grant", "revoke"].includes(tong.task?.action) ? tong.task : null;
  const working = task && !task.error && !["done", "refused"].includes(task.phase);
  if (!tong.identity?.ready)
    return (
      <section className="card span-2">
        <div className="card-head">
          <h3>Your limits</h3>
        </div>
        <p className="muted">Create your Tong account to get a policy: an app allowlist, per-call caps, a daily allowance and expiry, all on chain.</p>
      </section>
    );
  return (
    <section className="card span-2">
      <div className="card-head">
        <h3>Your account's policy</h3>
        <span className="chip">Live from get_identity</span>
      </div>
      <Meter label="Spent today (apps + sends)" value={today.spent} max={today.cap} fmt={nearFmt} />
      <ul className="grant-list">
        <li className="grant-row muted small">
          <span>App and methods</span>
          <span className="gr-hide">Per call</span>
          <span className="gr-hide">Expires</span>
          <span />
        </li>
        {p.grants.map((g) => (
          <li key={g.contract} className="grant-row">
            <span>
              <b className="mono">{g.contract}</b>
              <small className="mono">{g.methods.join(" · ")}</small>
            </span>
            <span className="gr-hide">{BigInt(g.max_deposit) === 0n ? "no deposit" : `≤ ${nearFmt(g.max_deposit)}`}</span>
            <span className="gr-hide">{until(g.expires_at)}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={working || !tong.canSign} onClick={() => tong.revoke(g.contract).catch(() => {})}>
              {working && task.request?.data?.includes(g.contract) ? <Spinner size={14} /> : <Trash2 size={14} />} Revoke
            </button>
          </li>
        ))}
        <li className="grant-row">
          <span>
            <b>Send NEAR</b>
            <small>any account</small>
          </span>
          <span className="gr-hide">≤ {nearFmt(p.send_cap)}</span>
          <span className="gr-hide">no expiry</span>
          <Status tone="ok">On</Status>
        </li>
        <li className="grant-row denied">
          <span>
            <b>Everything else</b>
            <small>other contracts, keys, deploys, deletes</small>
          </span>
          <span className="gr-hide">—</span>
          <span className="gr-hide">—</span>
          <Status tone="bad">
            <X size={11} /> Refused
          </Status>
        </li>
      </ul>
      <Outcome task={task} title={task?.label ?? "Policy updated"} />
      <p className="card-foot">
        Daily allowance {nearFmt(today.cap)} resets at 00:00 UTC. Grants are added by apps you approve and removed with one signature.
      </p>
    </section>
  );
}

function useLive() {
  const [s, setS] = useState({});
  const tong = useTongApp();
  const child = tong.identity?.ready ? tong.identity.account_id : null;
  useEffect(() => {
    getConfig()
      .then((c) => setS((x) => ({ ...x, config: c })))
      .catch((e) => setS((x) => ({ ...x, configError: e.message })));
    accessKeys(CONTRACT_ID)
      .then((k) => setS((x) => ({ ...x, factoryKeys: k.length })))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!child) return;
    accessKeys(child)
      .then((k) => setS((x) => ({ ...x, childKeys: k.length })))
      .catch(() => {});
  }, [child]);
  return s;
}

export default function Permissions() {
  const tong = useTongApp();
  const s = useLive();
  const c = s.config;
  const b = tong.health?.budget;
  const pct = (a, m) => Math.min(100, Math.round((Number(a) / Number(m)) * 100));
  return (
    <div className="perm-grid">
      <Policy />
      <section className="card span-2">
        <div className="card-head">
          <h3>What any wallet can ask Tong to do</h3>
          <span className="chip">Live from get_config</span>
        </div>
        <table className="tx-table perm-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Limit</th>
              <th>Paid by</th>
              <th className="r">Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["link", "Create your named account", "Once per wallet and name", c ? `Sponsor · ${formatNear(c.link_deposit, 2)} NEAR` : "…"],
              ["call", "Use an app", "Your grants: methods, per-call cap, expiry", "Sponsor gas · your NEAR"],
              ["send_near", "Send NEAR", "Per-transfer cap + daily allowance", "Sponsor gas · your NEAR"],
              ["grant", "Allow / remove an app", "≤ 1 NEAR per call · ≤ 30 days · 8 apps", "Sponsor gas"],
              ["set_note", "Save a note", "≤ 256 bytes", "Sponsor gas"],
              ["sign_sepolia", "Sign on Sepolia", "≤ 0.001 ETH · ≤ 100 gwei", c ? `Sponsor · ${formatNear(c.mpc_deposit, 2)} NEAR MPC fee` : "…"],
            ].map(([k, label, limit, fee]) => (
              <tr key={k}>
                <td>
                  <b>{label}</b>
                  <small className="mono block">{k}</small>
                </td>
                <td>{limit}</td>
                <td>{fee}</td>
                <td className="r">{c ? c.allowed_actions.includes(k) ? <Status tone="ok">Allowed</Status> : <Status tone="bad">Off</Status> : <Skeleton w={60} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card tile">
        <span className="tile-ico">
          <KeyRound size={18} />
        </span>
        <span className="tile-num">{tong.identity?.ready ? (s.childKeys ?? "…") : "—"}</span>
        <span className="tile-label">access keys on {tong.identity?.ready ? shortAccount(tong.identity.account_id) : "your account"}</span>
      </section>
      <section className="card tile">
        <span className="tile-ico">
          <Lock size={18} />
        </span>
        <span className="tile-num">{s.factoryKeys ?? "…"}</span>
        <span className="tile-label">
          keys on the Tong contract · locked {new Date(DEPLOYMENT.locked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </section>
      <section className="card tile">
        <span className="tile-ico">
          <TimerReset size={18} />
        </span>
        <span className="tile-num">{c ? `${c.max_expiry_seconds / 60} min` : "…"}</span>
        <span className="tile-label">longest a signature stays valid · next nonce {tong.identity?.nonce ?? "0"}</span>
      </section>

      <section className="card span-2">
        <div className="card-head">
          <h3>Sponsorship today</h3>
          <span className="muted small">{b ? `UTC ${b.day}` : tong.healthError ? "Sponsor offline" : "…"}</span>
        </div>
        {b ? (
          <div className="meters">
            <div>
              <div className="meter-top">
                <span>Sponsored actions</span>
                <b>
                  {b.calls} / {b.maxCalls}
                </b>
              </div>
              <div className="meter">
                <i style={{ width: `${pct(b.calls, b.maxCalls)}%` }} />
              </div>
            </div>
            <div>
              <div className="meter-top">
                <span>NEAR reserved</span>
                <b>
                  {formatNear(b.reserved, 2)} / {formatNear(b.maxReserved, 0)}
                </b>
              </div>
              <div className="meter">
                <i style={{ width: `${pct(BigInt(b.reserved) / 10n ** 20n, BigInt(b.maxReserved) / 10n ** 20n)}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Start the relayer to sponsor actions. Reads keep working without it.</p>
        )}
        <p className="card-foot">
          Paid by <span className="mono">{tong.health?.relayerId ?? "the relayer"}</span>. It checks the signature, then lets the contract decide
          everything else, so a refusal is visible on chain.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Guarantees</h3>
        </div>
        <ul className="checks">
          {[
            "Signatures name one action, one nonce",
            "Policy is checked on chain before any call",
            "App deposits come from your account, never the sponsor",
            "Your account cannot be upgraded",
            "Ethereum tx is built on chain, never a raw hash",
            "Derivation path tong:sepolia:11155111",
          ].map((t) => (
            <li key={t} className="pass">
              <Check size={14} /> {t}
            </li>
          ))}
        </ul>
        <p className="card-foot">
          <Ext href={nearAccount(CONTRACT_ID)}>{CONTRACT_ID}</Ext> · code {short(DEPLOYMENT.code_hash, 6, 4)}
        </p>
      </section>
    </div>
  );
}
