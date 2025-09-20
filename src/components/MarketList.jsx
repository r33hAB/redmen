// src/components/MarketList.jsx
import React from "react";
import { splitFrom, usd, fmtPct, num } from "../lib/metrics";

export default function ListView({ markets = [], onRowClick }) {
  const rows = markets
    .map((m) => ({ m, ...splitFrom(m) }))
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
          {rows.map(({ m, buy, sell, total }, i) => {
            const denom = buy + sell;
            const buyPct  = denom > 0 ? (buy / denom) * 100 : 50;
            const sellPct = denom > 0 ? 100 - buyPct : 50;

            const uBuy = num(m?.uniqueBuyers ?? m?.totals?.uniqueBuyers ?? m?.stats?.uniqueBuyers);
            const uSell = num(m?.uniqueSellers ?? m?.totals?.uniqueSellers ?? m?.stats?.uniqueSellers);
            const trades = num(m?.trades ?? m?.tradeCount ?? m?.totals?.trades ?? m?.stats?.trades);

            return (
              <tr
                key={m.id || m.slug || i}
                onClick={() => onRowClick && onRowClick(m)}
                style={{ cursor: "pointer" }}
              >
                <td style={tdR}>{i + 1}</td>
                <td style={tdL}>{m.title || m.question || m.name}</td>
                <td style={tdR}>{usd(total)}</td>
                <td style={tdR}>{fmtPct(buyPct)} / {fmtPct(sellPct)}</td>
                <td style={tdR}>{uBuy}/{uSell}</td>
                <td style={tdR}>{trades}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thBase = {
  padding: "10px 12px",
  color: "#9fb0c7",
  fontSize: 12,
  fontWeight: 600,
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
