import React, { useState } from "react";
import {
  Home,
  LayoutGrid,
  PenLine,
  Globe2,
  History,
  ShieldCheck,
  Code2,
  ChevronDown,
  Plus,
  MoreHorizontal,
  X,
  Unplug,
} from "lucide-react";
import { Logo } from "./Logo.jsx";
import { Avatar, cx, ChainIcon } from "./ui.jsx";
import { useTongApp } from "../lib/tong.jsx";
import { walletLabel, shortAccount } from "../lib/chain.js";

export const NAV = [
  { to: "#/app", label: "Account", icon: Home },
  { to: "#/app/apps", label: "Apps", icon: LayoutGrid },
  { to: "#/app/act", label: "Act on NEAR", short: "Act", icon: PenLine },
  { to: "#/app/sign", label: "Cross-chain", short: "Sign", icon: Globe2 },
  { to: "#/app/activity", label: "Activity", icon: History },
  { to: "#/app/permissions", label: "Permissions", icon: ShieldCheck },
  { to: "#/app/developers", label: "Developers", icon: Code2 },
];

function AccountMenu() {
  const tong = useTongApp();
  const [open, setOpen] = useState(false);
  if (!tong.active)
    return (
      <a className="btn btn-dark btn-sm" href="#/connect">
        Connect wallet
      </a>
    );
  return (
    <div className="acct-menu">
      <button type="button" className="acct-pill" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Avatar seed={tong.active} size={26} />
        <span className="acct-text">
          <b>{walletLabel(tong.active)}</b>
          <small>{tong.identity?.ready ? shortAccount(tong.identity.account_id) : "Not linked yet"}</small>
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="acct-pop" role="menu">
          <p className="pop-label">Your wallets</p>
          {tong.wallets.map((w) => (
            <button
              type="button"
              key={w.wallet}
              className={cx("pop-row", w.wallet === tong.active && "on")}
              onClick={() => {
                tong.switchTo(w.wallet);
                setOpen(false);
              }}
            >
              <span className={cx("w-ico w-xs", w.kind === "solana" ? "w-sol" : "w-eth")}>
                <ChainIcon kind={w.kind} size={13} />
              </span>
              <span>
                <b>{walletLabel(w.wallet)}</b>
                <small>{w.name}{w.wallet === tong.sessionWallet ? " · can sign" : ""}</small>
              </span>
            </button>
          ))}
          <a className="pop-row" href="#/connect" onClick={() => setOpen(false)}>
            <span className="w-ico w-xs">
              <Plus size={13} />
            </span>
            <span>
              <b>Add a wallet</b>
            </span>
          </a>
          {tong.sessionWallet && (
            <button
              type="button"
              className="pop-row"
              onClick={() => {
                tong.disconnect();
                setOpen(false);
              }}
            >
              <span className="w-ico w-xs">
                <Unplug size={13} />
              </span>
              <span>
                <b>Disconnect signer</b>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Shell({ route, title, subtitle, actions, children }) {
  const tong = useTongApp();
  const [more, setMore] = useState(false);
  const isActive = (to) => route === to || route.startsWith(to + "/");
  return (
    <div className="shell">
      <aside className="side">
        <a href="#/" className="brand-link side-brand">
          <Logo />
        </a>
        <nav aria-label="App">
          {NAV.map(({ to, label, icon: Icon }) => (
            <a key={to} href={to} className={cx("side-link", isActive(to) && "on")}>
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div className="net">
            <span className={cx("dot", tong.health ? "dot-ok" : "dot-off")} />
            <span>
              <b>NEAR testnet</b>
              <small>
                {tong.health
                  ? `Sponsor online · ${tong.health.budget?.calls ?? 0}/${tong.health.budget?.maxCalls ?? 40} today`
                  : "Sponsor offline · read-only"}
              </small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <a href="#/" className="brand-link top-brand">
            <Logo small />
          </a>
          <div className="top-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="top-actions">
            {actions}
            <AccountMenu />
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
      <nav className="tabbar" aria-label="App tabs">
        {NAV.slice(0, 4).map(({ to, label, short, icon: Icon }) => (
          <a key={to} href={to} className={cx(isActive(to) && "on")}>
            <Icon size={20} />
            <span>{short ?? label}</span>
          </a>
        ))}
        <button type="button" className={cx(more && "on")} onClick={() => setMore(true)}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>More</b>
              <button type="button" className="icon-btn" onClick={() => setMore(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            {NAV.slice(4).map(({ to, label, icon: Icon }) => (
              <a key={to} href={to} className="sheet-row" onClick={() => setMore(false)}>
                <Icon size={18} /> {label}
              </a>
            ))}
            <a href="#/" className="sheet-row" onClick={() => setMore(false)}>
              <Home size={18} /> Tong website
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function NeedWallet({ children }) {
  const tong = useTongApp();
  if (!tong.active)
    return (
      <div className="card need">
        <img src="/art/3d/wallet.webp" alt="" width="120" height="120" />
        <h2>Connect a wallet to continue</h2>
        <p>Tong works with the Ethereum or Solana wallet you already use.</p>
        <a className="btn btn-dark" href="#/connect">
          Connect wallet
        </a>
      </div>
    );
  if (tong.identity === null)
    return (
      <div className="card need">
        <img src="/art/3d/links-unlinked.webp" alt="" width="120" height="120" />
        <h2>Create your NEAR account first</h2>
        <p>One signature from {walletLabel(tong.active)} creates it. The sponsor covers storage on testnet.</p>
        <a className="btn btn-dark" href="#/connect">
          Create account
        </a>
      </div>
    );
  return children;
}
