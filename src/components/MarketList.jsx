import React from "react";
import { splitFrom, usd, fmtPct, num } from "../lib/metrics";

export default function ListView({ markets = [], onRowClick }) {
  // normalize & sort by numeric total flow
  const rows = markets
    .map((m) => {
      const s = splitFrom(m);
      return { m, ...s };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thL}>#</th>
            <th style={thL}>Market</th>
            <th style={thR}>Total</th>
            <th style={thR}>Split</th>
            <th style={thR}>Unique B/S</th>
            <th style={thR}>Trades</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const m = r.m;
            const title = m.title || m.question || m.name || m.slug || "—";

            const uBuy = num(
              m?.uniqueBuyers ?? m?.totals?.uniqueBuyers ?? m?.stats?.uniqueBuyers
            );
            const uSell = num(
              m?.uniqueSellers ?? m?.totals?.uniqueSellers ?? m?.stats?.uniqueSellers
            );
            const trades = num(
              m?.tradeCount ?? m?.totals?.tradeCount ?? m?.stats?.tradeCount
            );

            return (
              <tr
                key={m.id || m.slug || i}
                onClick={() => onRowClick && onRowClick(m)}
                style={{ cursor: onRowClick ? "pointer" : "default" }}
              >
                <td style={tdL}>{i + 1}</td>
                <td style={{ ...tdL, maxWidth: 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {title}
                </td>
                <td style={tdR}>{usd(r.total)}</td>
                <td style={tdR}>
                  {fmtPct(r.buyPct)} / {fmtPct(r.sellPct)}
                </td>
                <td style={tdR}>
                  {uBuy}/{uSell}
                </td>
                <td style={tdR}>{trades}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// minimal dark table styles inline to keep this drop-in
const thBase = {
  fontWeight: 600,
  fontSize: 12,
  color: "#a8b3c5",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  textTransform: "uppercase",
  letterSpacing: ".03em",
};
const tdBase = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  color: "#e6edf5",
  fontSize: 14,
};
const thL = { ...thBase, textAlign: "left" };
const thR = { ...thBase, textAlign: "right" };
const tdL = { ...tdBase, textAlign: "left" };
const tdR = { ...tdBase, textAlign: "right" };
