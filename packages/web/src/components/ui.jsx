import React, { useState } from "react";
import { Check, Copy, ArrowUpRight, LoaderCircle } from "lucide-react";

export const cx = (...p) => p.filter(Boolean).join(" ");

export function Spinner({ size = 16 }) {
  return <LoaderCircle size={size} className="spin" aria-hidden="true" />;
}

export function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export function Ext({ href, children, className }) {
  return (
    <a className={cx("ext", className)} href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}

export function EthMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5 5.5 12.2 12 16l6.5-3.8L12 2.5Z" fill="currentColor" opacity=".9" />
      <path d="M12 17.3 5.5 13.5 12 21.5l6.5-8L12 17.3Z" fill="currentColor" opacity=".55" />
    </svg>
  );
}
export function SolMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.4 6h13.1l-2 2.4H4.4L6.4 6Zm-2 4.8h13.1l2 2.4H6.4l-2-2.4Zm2 4.8h13.1l-2 2.4H4.4l2-2.4Z" fill="currentColor" />
    </svg>
  );
}
export function NearMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.9 4.3 13.6 9.2c-.2.3.2.7.5.4l3.2-2.8c.1-.1.3 0 .3.1v8.9c0 .2-.2.2-.3.1L7.6 4.6c-.3-.4-.8-.6-1.3-.6H6C5.1 4 4.4 4.7 4.4 5.6v12.8c0 .9.7 1.6 1.6 1.6.6 0 1.1-.3 1.4-.8l3.3-4.9c.2-.3-.2-.7-.5-.4l-3.2 2.8c-.1.1-.3 0-.3-.1V7.7c0-.2.2-.2.3-.1l9.7 11.8c.3.4.8.6 1.3.6h.4c.9 0 1.6-.7 1.6-1.6V5.6c0-.9-.7-1.6-1.6-1.6-.6 0-1.1.3-1.4.8Z"
        fill="currentColor"
      />
    </svg>
  );
}
export function ChainIcon({ kind, size = 18 }) {
  if (kind === "solana") return <SolMark size={size} />;
  if (kind === "near") return <NearMark size={size} />;
  return <EthMark size={size} />;
}

/* Deterministic gradient avatar from an address string. */
export function Avatar({ seed = "", size = 36 }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = h % 360;
  const b = (a + 40 + (h % 80)) % 360;
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, hsl(${a} 85% 82%), hsl(${b} 70% 58%) 70%)`,
      }}
    />
  );
}

export function Status({ tone = "neutral", children }) {
  return <span className={cx("status", `status-${tone}`)}>{children}</span>;
}

export function Empty({ art, title, children, action }) {
  return (
    <div className="empty">
      {art && <img src={art} alt="" width="120" height="120" loading="lazy" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ children, onClose }) {
  return (
    <div className="error-note" role="alert">
      <span>{children}</span>
      {onClose && (
        <button type="button" className="link-btn" onClick={onClose}>
          Dismiss
        </button>
      )}
    </div>
  );
}

export function Skeleton({ w = "100%", h = 14 }) {
  return <span className="skeleton" style={{ width: w, height: h }} aria-hidden="true" />;
}

export function Steps({ steps, current, error }) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="steps">
      {steps.map((s, i) => {
        const state = current === "done" || i < idx ? "done" : i === idx ? (error ? "error" : "active") : "todo";
        return (
          <li key={s.key} className={`step step-${state}`}>
            <span className="step-dot">{state === "done" ? <Check size={12} /> : state === "active" ? <Spinner size={12} /> : null}</span>
            <span>
              <strong>{s.label}</strong>
              {s.hint && <small>{s.hint}</small>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
