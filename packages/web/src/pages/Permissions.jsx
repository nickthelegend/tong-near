import React, { useEffect, useState } from "react";
import { Check, KeyRound, Lock, TimerReset, X } from "lucide-react";
import { useTongApp } from "../lib/tong.jsx";
import { CONTRACT_ID, DEPLOYMENT, accessKeys, getConfig, formatNear, nearAccount, short, shortAccount, walletLabel } from "../lib/chain.js";
import { Ext, Skeleton, Status } from "../components/ui.jsx";

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
      <section className="card span-2">
        <div className="card-head">
          <h3>What {tong.active ? walletLabel(tong.active) : "a wallet"} can do on NEAR</h3>
          <span className="chip">Live from get_config</span>
        </div>
        <table className="tx-table perm-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Limit</th>
              <th>Fee (sponsored)</th>
              <th className="r">Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["link", "Create your account", "Once per wallet", c ? `${formatNear(c.link_deposit, 2)} NEAR storage` : "…"],
              ["set_note", "Save a note", "≤ 256 bytes, no deposit", "Gas only"],
              ["sign_sepolia", "Sign on Sepolia", "≤ 0.001 ETH · ≤ 100 gwei · 21,000 gas", c ? `${formatNear(c.mpc_deposit, 2)} NEAR MPC fee` : "…"],
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
            <tr className="denied">
              <td>
                <b>Any other call</b>
                <small className="block">transfers, keys, upgrades, arbitrary hashes</small>
              </td>
              <td>—</td>
              <td>—</td>
              <td className="r">
                <Status tone="bad">
                  <X size={11} /> Blocked
                </Status>
              </td>
            </tr>
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
          Paid by <span className="mono">{tong.health?.relayerId ?? "the relayer"}</span>. It rejects bad signatures and stale nonces before
          spending anything.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Guarantees</h3>
        </div>
        <ul className="checks">
          {[
            "Signatures name one action, one nonce",
            "Nonce is consumed before any call",
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
