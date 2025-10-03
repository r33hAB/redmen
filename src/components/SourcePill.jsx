// src/components/SourcePill.jsx
import React from "react";
import { sourceBadge, sourceBadgeShort } from "../lib/badge.js";

/**
 * Props:
 *  - market
 *  - variant: "default" | "compact"
 */
export default function SourcePill({ market, variant = "default" }) {
  const label = variant === "compact" ? sourceBadgeShort(market) : sourceBadge(market);
  const isKalshi = String(market?.source || "").toLowerCase() === "kalshi";
  const accent = isKalshi ? "#f59e0b" : "#3b82f6"; // amber vs blue

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: variant === "compact" ? "2px 6px" : "4px 10px",
        borderRadius: 999,
        fontSize: variant === "compact" ? 11 : 12,
        lineHeight: 1,
        border: "1px solid #2b3c52",
        background: "#0f1a27",
        color: "#c6cfdb",
        boxShadow: `inset 0 0 0 1px ${accent}22`,
      }}
      title={sourceBadge(market)}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />
      {label}
    </span>
  );
}
