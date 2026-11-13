import React, { useEffect, useState } from "react";
import { ArrowDown, Check, Copy, ExternalLink, Globe2, Radio, X } from "lucide-react";
import { parseEther, isAddress } from "ethers";
import { useTongApp } from "../lib/tong.jsx";
import { formatEth, formatGwei, formatWeiSmart, nearTx, sepoliaAddress, sepoliaTx, short, shortAccount, sepoliaSnapshot } from "../lib/chain.js";
import { NeedWallet } from "../components/Shell.jsx";
import { EthMark, NearMark, Spinner, Steps, ErrorNote, CopyButton, cx } from "../components/ui.jsx";

const SIGN_STEPS = [
  { key: "prepare", label: "Build transfer", hint: "Live Sepolia nonce and gas" },
  { key: "wallet", label: "Approve in your wallet", hint: "One typed signature" },
  { key: "relay", label: "NEAR MPC signs", hint: "v1.signer-prod.testnet" },
];
const CHAINS = [
  { id: "sepolia", name: "Sepolia", live: true },
  { id: "base", name: "Base Sepolia", live: false },
  { id: "arb", name: "Arbitrum Sepolia", live: false },
  { id: "sol", name: "Solana devnet", live: false },
];

export default function CrossChain() {
  const tong = useTongApp();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0");
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [record, setRecord] = useState(null);
  const [bcast, setBcast] = useState(null);
  const task = tong.task?.action === "sign_sepolia" ? tong.task : null;
  const working = task && !task.error && task.phase !== "done";
  const latest = record ?? tong.signed[0] ?? null;

  useEffect(() => {
    if (!tong.derived) return;
    let on = true;
    const load = () =>
      sepoliaSnapshot(tong.derived)
        .then((s) => on && setSnap(s))
        .catch((e) => on && setSnap({ error: e.message }));
    load();
    const t = setInterval(load, 15000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [tong.derived]);

  let valueWei = null;
  try {
    valueWei = parseEther(amount || "0");
  } catch {
    valueWei = null;
  }
  const recipient = to.trim() || tong.derived || "";
  const gas = snap?.gasPrice ? snap.gasPrice * 2n : null;
  const checks = [
    ["Recipient is a 20-byte address", isAddress(recipient)],
    ["Amount ≤ 0.001 ETH", valueWei !== null && valueWei <= 10n ** 15n],
    ["Gas price ≤ 100 gwei", gas !== null && gas <= 100n * 10n ** 9n],
    ["Chain ID 11155111, no calldata", true],
  ];
  const ok = checks.every((c) => c[1]);

  async function sign() {
    setError(null);
    setBcast(null);
    try {
      const t = await tong.prepareTransfer({ to: recipient, valueWei: valueWei.toString() });
      setRecord(await tong.signSepolia(t));
    } catch (e) {
      setError(e.message);
    }
  }
  async function broadcast() {
    setError(null);
    setBcast({ busy: true });
    try {
      setBcast({ hash: await tong.broadcast(latest) });
    } catch (e) {
      setBcast({ error: e.message });
    }
  }
  const funded = latest && snap?.balance !== undefined && snap.balance >= BigInt(latest.maxCostWei);

  return (
    <NeedWallet>
      <div className="chain-tabs" role="tablist" aria-label="Destination chain">
        {CHAINS.map((c) => (
          <button key={c.id} type="button" role="tab" aria-selected={c.live} className={cx("chain-tab", c.live && "on")} disabled={!c.live} title={c.live ? "" : "Not in Tong's v1 policy"}>
            {c.name}
            {!c.live && <small>Soon</small>}
          </button>
        ))}
      </div>
      <div className="xc-grid">
        <section className="card xc-form">
          <div className="xc-panel">
            <span className="xc-label">From your NEAR account</span>
            <div className="xc-row">
              <span className="w-ico w-near">
                <NearMark />
              </span>
              <span className="grow">
                <b className="mono">{shortAccount(tong.identity?.account_id)}</b>
                <small>signs through Chain Signatures as</small>
              </span>
            </div>
            <div className="xc-row">
              <span className="w-ico w-eth">
                <EthMark />
              </span>
              <span className="grow">
                <b className="mono">{tong.derived ? short(tong.derived, 8, 6) : "Deriving…"}</b>
                <small>
                  Balance {snap?.balance !== undefined ? `${formatEth(snap.balance, 8)} ETH` : snap?.error ? "unavailable" : "…"} · nonce{" "}
                  {snap?.nonce !== undefined ? String(snap.nonce) : "…"}
                </small>
              </span>
              {tong.derived && <CopyButton text={tong.derived} label="Copy Sepolia address" />}
            </div>
          </div>
          <div className="xc-swap" aria-hidden="true">
            <ArrowDown size={16} />
          </div>
          <div className="xc-panel">
            <span className="xc-label">To on Sepolia</span>
            <input
              className="xc-input mono"
              placeholder={tong.derived ? `${tong.derived} (yourself)` : "0x…"}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={working}
              aria-label="Recipient address"
            />
            <div className="xc-amount">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={working} inputMode="decimal" aria-label="Amount in ETH" />
              <span>ETH</span>
            </div>
            <small className="muted">Max 0.001 ETH per signature.</small>
          </div>
          {task && !task.error && <Steps steps={SIGN_STEPS} current={task.phase} />}
          <button type="button" className="btn btn-dark btn-lg btn-block" disabled={!ok || working || !tong.derived || !tong.canSign} onClick={sign}>
            {working ? <Spinner /> : <Globe2 size={18} />}
            {working ? tong.phases[task.phase] + "…" : "Sign with Chain Signatures"}
          </button>
          <p className="muted small">Costs you nothing. The sponsor attaches the 0.01 NEAR MPC fee.</p>
          {(error || task?.error) && <ErrorNote onClose={() => { setError(null); tong.clearTask(); }}>{error || task.error}</ErrorNote>}
        </section>

        <section className="xc-side">
          <div className="card">
            <div className="card-head">
              <h3>Policy check</h3>
              <span className="mono small">{gas !== null ? formatGwei(gas) : "…"}</span>
            </div>
            <ul className="checks">
              {checks.map(([label, pass]) => (
                <li key={label} className={pass ? "pass" : "fail"}>
                  {pass ? <Check size={14} /> : <X size={14} />} {label}
                </li>
              ))}
            </ul>
          </div>

          {latest ? (
            <div className="card signed-card">
              <div className="card-head">
                <h3>Signed transaction</h3>
                {latest.broadcast || bcast?.hash ? (
                  <span className="status status-ok">Broadcast</span>
                ) : (
                  <span className="status status-warm">Signed · not broadcast</span>
                )}
              </div>
              <dl className="kv">
                <div>
                  <dt>Signer</dt>
                  <dd className="mono">
                    <a href={sepoliaAddress(latest.from)} target="_blank" rel="noreferrer">
                      {short(latest.from, 8, 6)}
                    </a>{" "}
                    <Check size={12} className="ok-ico" /> matches your address
                  </dd>
                </div>
                <div>
                  <dt>Tx hash</dt>
                  <dd className="mono">{short(latest.hash, 10, 8)}</dd>
                </div>
                <div>
                  <dt>MPC request</dt>
                  <dd className="mono">
                    <a href={nearTx(latest.nearTx)} target="_blank" rel="noreferrer">
                      {short(latest.nearTx, 8, 6)} <ExternalLink size={11} />
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Raw</dt>
                  <dd className="mono wrap raw">
                    {latest.rawTransaction.slice(0, 66)}… <CopyButton text={latest.rawTransaction} label="Copy raw transaction" />
                  </dd>
                </div>
              </dl>
              {latest.broadcast || bcast?.hash ? (
                <a className="receipt" href={sepoliaTx(latest.broadcast?.hash ?? bcast.hash)} target="_blank" rel="noreferrer">
                  <Radio size={14} /> Sent to Sepolia · {short(latest.broadcast?.hash ?? bcast.hash, 8, 6)} <ExternalLink size={12} />
                </a>
              ) : funded ? (
                <button type="button" className="btn btn-coral btn-block" onClick={broadcast} disabled={bcast?.busy}>
                  {bcast?.busy ? <Spinner /> : <Radio size={16} />} Broadcast to Sepolia
                </button>
              ) : (
                <div className="unfunded">
                  <b>Needs Sepolia test ETH to broadcast</b>
                  <p>
                    This transaction can spend up to {formatWeiSmart(latest.maxCostWei)} of Sepolia test ETH for gas. The address holds{" "}
                    {snap?.balance !== undefined ? formatWeiSmart(snap.balance) : "…"}. Fund{" "}
                    <span className="mono">{short(latest.from, 6, 4)}</span> and broadcast here.
                  </p>
                </div>
              )}
              {bcast?.error && <ErrorNote>{bcast.error}</ErrorNote>}
            </div>
          ) : (
            <div className="card empty-mini">
              <img src="/art/v2/signature-bridge.webp" alt="" width="84" height="84" />
              <p>Your signed Sepolia transactions appear here, with the signer recovered and checked.</p>
            </div>
          )}
        </section>
      </div>
    </NeedWallet>
  );
}
