// src/components/BubbleHeatmap.jsx
import React, { useMemo } from "react";
import SourcePill from "./SourcePill.jsx";

/**
 * BubbleHeatmap
 * Props:
 *  - markets: array of { conditionId, title, totalUSD, buyUSD, sellUSD, source }
 *  - onSelect: function(market) when a tile is clicked
 */
export default function BubbleHeatmap({ markets = [], onSelect = () => {} }) {
  const prepared = useMemo(() => {
    const arr = Array.isArray(markets) ? markets.slice() : [];
    // intensity by log(total)
    const vals = arr.map(m => Math.max(1, Number(m.totalUSD || 0)));
    const min = Math.min(...vals, 1);
    const max = Math.max(...vals, 1);
    const scale = (v) => {
      const x = Math.log10(Math.max(1, v));
      const a = Math.log10(Math.max(1, min));
      const b = Math.log10(Math.max(1, max));
      return (x - a) / ((b - a) || 1);
    };
    return arr.map(m => {
      const buy = Number(m?.buyUSD || 0);
      const sell = Number(m?.sellUSD || 0);
      const total = buy + sell;
      const pct = total > 0 ? (buy / total) : 0.5;
      return { ...m, _int: scale(Number(m.totalUSD || 0)), _pct: pct };
    });
  }, [markets]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
      }}
    >
      {prepared.map((m) => {
        const pct = Math.max(0, Math.min(1, m._pct || 0.5));
        const deg = Math.round(pct * 360);
        const R = 66;
        // softer backgrounds, consistent
        const g = Math.round(70 + m._int * 110);
        const r = Math.round(170 - m._int * 120);
        const bg = `rgba(${r}, ${g}, 90, 0.10)`;
        const border = `1px solid rgba(${r}, ${g}, 110, 0.35)`;

        return (
          <div
            key={m.conditionId || m.slug || m.title}
            onClick={() => onSelect(m)}
            style={{
              position: "relative",
              background: bg,
              border, borderRadius: 12,
              padding: 12, cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div
                style={{
                  color: "#e6edf5",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: "18px",
                  maxHeight: 36
                }}
                title={m.title}
              >
                {m.title || m.slug || "Market"}
              </div>
              <SourcePill market={m} variant="compact" />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: R, height: R, borderRadius: "50%",
                  background: `conic-gradient(#22c55e ${deg}deg, #ef4444 ${deg}deg 360deg)`,
                  display: "grid", placeItems: "center",
                }}
                title={`YES ${(pct * 100).toFixed(1)}%`}
              >
                <div
                  style={{
                    width: R-10, height: R-10,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.25)",
                    color: "#c6cfdb", fontWeight: 700, fontSize: 13,
                    display: "grid", placeItems: "center",
                    border: "1px solid #223247",
                  }}
                >
                  {(pct * 100).toFixed(0)}%
                </div>
              </div>

              <div style={{ color: "#9fb0c7", fontSize: 12 }}>
                <div>${Math.round(Number(m.totalUSD || 0)).toLocaleString()} total</div>
                <div>buys/sells ${Math.round(Number(m.buyUSD || 0)).toLocaleString()}/{Math.round(Number(m.sellUSD || 0)).toLocaleString()}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
