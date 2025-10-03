import React, { useMemo } from "react";

function usd(x){ return `$${(Number(x)||0).toLocaleString()}`; }
function kalshiGroupAndOutcome(m){
  const id = String(m?.conditionId || m?.id || "");
  const parts = id.split("-");
  if (parts.length < 2) return { group:null, outcome:null };
  return { group: parts.slice(0,-1).join("-"), outcome: parts[parts.length-1] };
}

export default function MarketCard({ market }) {
  const data = useMemo(() => {
    const m = market || {};
    const source = String(m?.source||"").toLowerCase();
    const total = Number(m?.totalUSD ?? m?.totals?.totalUSD ?? 0) || 0;
    const buy = Number(m?.buyUSD ?? m?.totals?.buyUSD ?? 0) || 0;
    const sell= Number(m?.sellUSD ?? m?.totals?.sellUSD ?? 0) || 0;
    let p = 1;
    if (source === "kalshi") {
      // On the card we only know about this contract; show 100% unless we can estimate from appended siblings in props (not available here)
      const denom = buy+sell;
      p = denom>0 ? buy/denom : (total>0 ? 1 : 0);
    } else {
      const denom = buy+sell;
      p = denom>0 ? buy/denom : (total>0 ? 1 : 0);
    }
    return { p, total, source };
  }, [market]);

  const deg = Math.round(data.p*360);
  const bg = `conic-gradient(#22c55e ${deg}deg, #ef4444 0deg)`;

  return (
    <div style={{ background:"#0b1520", border:"1px solid #223247", borderRadius:16, padding:16 }}>
      <div style={{ display:"grid", placeItems:"center", padding:10 }}>
        <div style={{ width:120, height:120, borderRadius:"50%", background:bg, display:"grid", placeItems:"center" }}>
          <div style={{ width:86, height:86, borderRadius:"50%", background:"#102234" }} />
        </div>
      </div>
      <div style={{ textAlign:"center", color:"#d7e2f1", fontSize:14, marginTop:6, minHeight:38 }}>
        {market?.title || market?.question || market?.slug || "Untitled"}
      </div>
      <div style={{ textAlign:"center", marginTop:6 }}>
        <span style={{
          display:"inline-flex", alignItems:"center", gap:6,
          fontSize:11, padding:"3px 8px", borderRadius:9999,
          border:"1px solid rgba(255,255,255,.08)",
          background: data.source === "kalshi" ? "rgba(245,158,11,.15)" : (data.source === "polymarket" ? "rgba(59,130,246,.15)" : "rgba(148,163,184,.15)"),
          color: data.source === "kalshi" ? "#f59e0b" : (data.source === "polymarket" ? "#60a5fa" : "#94a3b8")
        }}>{data.source === "kalshi" ? "Kalshi" : (data.source === "polymarket" ? "Polymarket" : "Unknown")}</span>
      </div>
      <div style={{ textAlign:"center", color:"#9fb0c7", fontSize:12, marginTop:8 }}>
        {usd(data.total)}
      </div>
    </div>
  );
}
