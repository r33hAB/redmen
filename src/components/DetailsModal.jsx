// src/components/DetailsModal.jsx
import React from "react";
import { splitFrom, usd, num } from "../lib/metrics";

// Shorten 0x… addresses nicely
const shortAddr = (w) =>
  w && w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : (w || "");

// Prefer daemon-provided label/display, then other fields, else short wallet
function bettorName(b = {}) {
  const candidate =
    b.label ??                 // added by api.js post-processing
    b.display ??               // COALESCE(name,pseudonym) from daemon
    b.pseudonym ??             // just in case
    b.name ??
    b.displayName ??
    b.username ??
    b.profile?.name ??
    b.profile?.displayName ??
    "";

  const trimmed = String(candidate || "").trim();
  if (trimmed) return trimmed;

  // fallback: shortened address/wallet/id
  return shortAddr(b.wallet || b.address || b.id || "");
}

export default function DetailsModal({ market, detail, onClose }) {
  if (!market) return null;

  const totals = detail?.totals || market?.totals || market?.stats || {};
  const { buy, sell, total } = splitFrom({ totals, ...market });

  const uniqB = num(market?.uniqueBuyers ?? totals.uniqueBuyers);
  const uniqS = num(market?.uniqueSellers ?? totals.uniqueSellers);
  const trades = num(
    detail?.totals?.trades ??
      market?.trades ??
      market?.tradeCount ??
      totals.trades
  );

  const title = market?.title || market?.question || market?.name || "Market";

  const outcomesAgg = detail?.outcomes || {};
  const outcomeLabels = Array.isArray(market?.outcomes)
    ? market.outcomes
    : Object.keys(outcomesAgg);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={xbtn}>
            Close
          </button>
        </div>

        <div style={chips}>
          <span style={chip}>{usd(total)}</span>
          <span style={chip}>buys/sells {usd(buy)}/{usd(sell)}</span>
          <span style={chip}>unique {uniqB}/{uniqS}</span>
          <span style={chip}>trades {trades}</span>
        </div>

        <div style={card}>
          <div style={cardTitle}>Outcomes</div>
          {outcomeLabels.map((label, idx) => {
            const byLabel = outcomesAgg[label];
            const byIdx = outcomesAgg[String(idx)];
            const o = byLabel || byIdx || { usd: 0, trades: 0 };
            return (
              <div key={label} style={row}>
                <div style={{ flex: 1 }}>{label}</div>
                <div style={{ ...mono }}>
                  {usd(o.usd)} • trades {o.trades}
                </div>
              </div>
            );
          })}
          {outcomeLabels.length === 0 && (
            <div style={{ color: "#a8b3c5" }}>No outcome breakdown available.</div>
          )}
        </div>

        {Array.isArray(detail?.topBettors) && (
          <div style={{ ...card, marginTop: 12 }}>
            <div style={cardTitle}>Top bettors</div>
            {detail.topBettors.map((b, i) => {
              const name = bettorName(b);
              const amount = usd(num(b.usd ?? b.totalUSD ?? b.flowUSD));
              const tcount = num(b.trades);

              return (
                <div key={b.id || b.address || b.wallet || i} style={row}>
                  <div style={{ flex: 1 }}>{name || "—"}</div>
                  <div style={mono}>
                    {amount} • trades {tcount}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,16,.6)",
  backdropFilter: "blur(2px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 60,
};
const modal = {
  background: "#0b1322",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12,
  width: "min(880px, 90vw)",
  maxHeight: "85vh",
  overflow: "auto",
  padding: 16,
  boxShadow: "0 12px 40px rgba(0,0,0,.45)",
};
const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};
const xbtn = {
  background: "transparent",
  color: "#a8b3c5",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8,
  padding: "6px 10px",
  cursor: "pointer",
};
const chips = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  margin: "6px 0 14px",
};
const chip = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.08)",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 13,
  color: "#c7d2e1",
};
const card = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.08)",
  padding: 12,
  borderRadius: 10,
};
const cardTitle = {
  fontWeight: 600,
  color: "#c7d2e1",
  marginBottom: 8,
};
const row = {
  display: "flex",
  alignItems: "center",
  padding: "6px 0",
  borderBottom: "1px dashed rgba(255,255,255,.06)",
};
const mono = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};
