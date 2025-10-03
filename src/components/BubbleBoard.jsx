// src/components/BubbleBoard.jsx
import React, { useMemo } from "react";
import SourcePill from "./SourcePill.jsx";
import { kalshiGroupKey } from "../lib/badge.js";

export default function BubbleBoard({ markets = [], onSelect = () => {} }) {
  const prepared = useMemo(() => {
    const arr = Array.isArray(markets) ? markets.slice() : [];

    // Precompute group sums for Kalshi twin markets
    const groups = new Map();
    for (const m of arr) {
      if (String(m?.source || "").toLowerCase() !== "kalshi") continue;
      const key = kalshiGroupKey(m);
      const total = Number(m?.totalUSD || (Number(m?.buyUSD||0) + Number(m?.sellUSD||0)) || 0);
      const g = groups.get(key) || { sum: 0 };
      g.sum += total;
      groups.set(key, g);
    }

    // compute global min/max for diameter scaling
    const allTotals = arr.map(mm => Number(mm?.totalUSD || (Number(mm?.buyUSD||0)+Number(mm?.sellUSD||0)) || 0));
    const gmin = Math.min(...allTotals, 0);
    const gmax = Math.max(...allTotals, 1);

    return arr.map((m) => {
      const source = String(m?.source || "").toLowerCase();
      const buy = Number(m?.buyUSD || 0);
      const sell = Number(m?.sellUSD || 0);
      const total = Number(m?.totalUSD || (buy + sell) || 0);
      let pct;

      if (source === "kalshi") {
        const key = kalshiGroupKey(m);
        const g = groups.get(key);
        const denom = Math.max(1, g?.sum || total || 1);
        pct = total / denom; // share of flow vs the twin market(s)
      } else {
        const denom = Math.max(1, buy + sell);
        pct = buy / denom;
      }

      const tRaw = (total - gmin) / ((gmax - gmin) || 1);
      const s = Math.sqrt(Math.max(0, Math.min(1, tRaw)));
      const d = Math.round(56 + s * (140 - 56));

      return { ...m, _total: total, _pct: pct, _d: d, _trades: Number(m?.trades||0) };
    });
  }, [markets]);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
      {prepared.map((m) => {
        const pct = Math.max(0, Math.min(1, m._pct || 0.5));
        const deg = Math.round(pct * 360);
        const d = Math.max(40, Math.min(180, m._d || 56));
        const ring = `conic-gradient(#22c55e ${deg}deg, #ef4444 ${deg}deg 360deg)`;
        const title = m.title || m.slug || "Market";

        return (
          <div
            key={m.conditionId || m.slug || title}
            onClick={() => onSelect(m)}
            style={{ position:"relative", background:"#0b1520", border:"1px solid #1e2a3a", borderRadius: 14, padding: 12, cursor: "pointer", display:"grid", gap: 10, justifyItems:"center" }}
            title={`$${Math.round(m._total||0).toLocaleString()} total • trades ${Math.round(m._trades||0)}`}
          >
            <div style={{ position:"absolute", top:8, right:8 }}>
              <SourcePill market={m} variant="compact" />
            </div>

            <div style={{ width: d, height: d, borderRadius:"50%", background: ring, display:"grid", placeItems:"center" }}>
              <div style={{ width: d-14, height: d-14, borderRadius:"50%", background:"#0b1520", border:"1px solid #223247", display:"grid", placeItems:"center", color:"#c6cfdb", fontWeight:700, fontSize:14 }}>
                {(pct * 100).toFixed(0)}%
              </div>
            </div>

            <div style={{ color:"#e6edf5", fontWeight:600, fontSize:14, textAlign:"center", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", textOverflow:"ellipsis", lineHeight:"18px", minHeight:36 }} title={title}>
              {title}
            </div>

            <div style={{ color:"#9fb0c7", fontSize:12, textAlign:"center" }}>
              ${Math.round(m._total || 0).toLocaleString()} total • trades {Math.round(m._trades || 0).toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
