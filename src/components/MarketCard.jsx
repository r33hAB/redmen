import React from "react";

function usd(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v/1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default function MarketCard({ market, onClick }) {
  const total = Number(market?.totalUSD ?? market?.totals?.totalUSD ?? 0);
  const buys  = Number(market?.buyUSD ?? market?.buys ?? market?.totals?.buyUSD ?? 0);
  const sells = Number(market?.sellUSD ?? market?.sells ?? market?.totals?.sellUSD ?? 0);
  const ub    = Number(market?.uniqueBuyers ?? market?.totals?.uniqueBuyers ?? 0);
  const us    = Number(market?.uniqueSellers ?? market?.totals?.uniqueSellers ?? 0);

  const pct = (n,d) => d>0 ? Math.round((n/d)*100) : 0;
  const pBuy = pct(buys, total);
  const pSell = 100 - pBuy;

  const ring = {
    background: `conic-gradient(#22c55e 0 ${pBuy}%, #f43f5e ${pBuy}% 100%)`,
    borderRadius: "50%",
    width: 34, height: 34,
    boxShadow: "inset 0 0 0 4px #0b1015, 0 1px 6px rgba(0,0,0,.35)",
    flex:"0 0 auto"
  };

  return (
    <div className="card" onClick={onClick} style={{display:"flex", alignItems:"center", gap:12}}>
      <div style={ring} title={`${pBuy}% / ${pSell}%`} />
      <div style={{flex:1, minWidth:0}}>
        <div className="title" style={{marginBottom:6}}>{market?.title || market?.slug || "Untitled market"}</div>
        <div className="meta">{`${usd(total)} • ${pBuy}%/${pSell}% • ${ub}/${us}`}</div>
      </div>
    </div>
  );
}
