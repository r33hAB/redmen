// src/components/MarketCard.jsx
import React from "react";
function usd(n){ const v = Number(n || 0); if (v >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`; if (v >= 1_000) return `$${(v/1_000).toFixed(1)}k`; return `$${v.toFixed(0)}`; }
function toNum(x){ return x == null ? 0 : +x || 0; }
function fmtPct(p){ return `${p.toFixed(1)}%`; }
function ringSplit(market){
  let outs = [];
  if (Array.isArray(market?.outcomes)) outs = market.outcomes.map(o => ({ label: o.label ?? o.name ?? "", usd: toNum(o.usd ?? o.totalUSD ?? o.flowUSD) }));
  else if (market?.outcomes && typeof market.outcomes === "object") outs = Object.entries(market.outcomes).map(([label, v]) => ({ label, usd: toNum(v?.usd ?? v?.totalUSD ?? v?.flowUSD) }));
  if (outs.length >= 2){ outs.sort((a,b)=> (b.usd||0)-(a.usd||0)); const a = toNum(outs[0].usd), b = toNum(outs[1].usd), tot=a+b; if (tot>0) return { aPct:(a/tot)*100, bPct:(b/tot)*100, mode:"outcomes" }; }
  const buy = toNum(market?.buyUSD ?? market?.buys ?? market?.totals?.buyUSD); const sell = toNum(market?.sellUSD ?? market?.sells ?? market?.totals?.sellUSD);
  const tot = buy+sell; if (tot>0) return { aPct:(buy/tot)*100, bPct:(sell/tot)*100, mode:"flow" };
  return { aPct:50, bPct:50, mode:"empty" };
}
export default function MarketCard({ market, onClick }){
  const total = toNum(market?.totalUSD ?? market?.totals?.totalUSD);
  const ub = toNum(market?.uniqueBuyers ?? market?.totals?.uniqueBuyers);
  const us = toNum(market?.uniqueSellers ?? market?.totals?.uniqueSellers);
  const { aPct, bPct, mode } = ringSplit(market);
  return (
    <div onClick={onClick} style={{ background:"#0f1520", border:"1px solid #2b3c52", borderRadius:16, padding:12, cursor:"pointer" }} title={mode==="outcomes"?"Outcome split":"Buy/Sell split"}>
      <div style={{ background:`conic-gradient(#22c55e 0 ${Math.round(aPct)}%, #f43f5e ${Math.round(aPct)}% 100%)`, borderRadius:"50%", width:120, height:120, boxShadow:"inset 0 0 0 10px #0b1015, 0 2px 10px rgba(0,0,0,.35)", margin:"0 auto" }} />
      <div style={{ textAlign:"center", color:"#c6cfdb", marginTop:8, fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{market?.title || market?.slug || "Untitled"}</div>
      <div style={{ textAlign:"center", color:"#9ba7b4", marginTop:6, fontSize:12 }}>{usd(total)} • {fmtPct(aPct)} / {fmtPct(bPct)} • {ub}/{us}</div>
    </div>
  );
}
