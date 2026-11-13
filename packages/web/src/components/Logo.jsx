import React from "react";

export function Mark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark">
      <rect width="32" height="32" rx="9" fill="#cc4256" />
      <circle cx="12.5" cy="16" r="5.6" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="19.5" cy="16" r="5.6" fill="none" stroke="#fff6f2" strokeWidth="2.6" opacity=".8" />
    </svg>
  );
}

export function Logo({ small = false }) {
  return (
    <span className={small ? "logo logo-sm" : "logo"}>
      <Mark size={small ? 22 : 28} />
      <span>tong</span>
    </span>
  );
}
