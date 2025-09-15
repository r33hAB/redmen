// src/components/MarketsList.jsx
import React, { useMemo } from "react";
import { ringSplit, fmtPct } from "../lib/api.js"; // relative path (no '@' alias)

const toNum = (x) => (x == null ? 0 : +x || 0);
function compactUSD(v) {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function MarketsList({ markets = [], onSelect, selectedSlug }) {
  const rows = useMemo(() => {
    return markets
      .map((m) => {
        const id = m.conditionId || m.slug || m.title;
        const { aPct, bPct } = ringSplit(m); // outcomes-first, fallback to flow
        return {
          id,
          title: m.title || m.slug || "Untitled",
          total: toNum(m.totalUSD ?? m.totals?.totalUSD),
          aPct,
          bPct,
          ub: toNum(m.uniqueBuyers ?? m.totals?.uniqueBuyers),
          us: toNum(m.uniqueSellers ?? m.totals?.uniqueSellers),
          trades: toNum(m.trades ?? m.totals?.trades),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [markets]);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          color: "#c6cfdb",
        }}
      >
        <thead>
          <tr style={{ background: "#0f1520" }}>
            <th style={th}>#</th>
            <th style={thLeft}>Market</th>
            <th style={th}>Total</th>
            <th style={th}>Split</th>
            <th style={th}>Unique B/S</th>
            <th style={th}>Trades</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const selected = selectedSlug && selectedSlug === r.id;
            return (
              <tr
                key={r.id}
                onClick={() => onSelect && onSelect({ conditionId: r.id })}
                style={{
                  background: selected ? "#11213a" : "#0b1015",
                  cursor: "pointer",
                }}
              >
                <td style={td}>{i + 1}</td>
                <td
                  style={{
                    ...tdLeft,
                    maxWidth: 560,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={r.title}
                >
                  {r.title}
                </td>
                <td style={td}>{compactUSD(r.total)}</td>
                <td style={td}>{fmtPct(r.aPct)} / {fmtPct(r.bPct)}</td>
                <td style={td}>{r.ub}/{r.us}</td>
                <td style={td}>{r.trades}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  textAlign: "center",
  borderBottom: "1px solid #223042",
};
const thLeft = { ...th, textAlign: "left" };

const td = {
  padding: "10px 12px",
  fontSize: 13,
  textAlign: "center",
  borderBottom: "1px solid #1a2635",
};
const tdLeft = { ...td, textAlign: "left" };
