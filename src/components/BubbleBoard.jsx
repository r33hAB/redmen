
import React, { useMemo, useRef, useEffect, useState } from "react";

// Split-ring bubble board (uses robust buy/sell fallbacks)
export default function BubbleBoard({ markets = [], onSelect, selectedSlug }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 1200 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.getBoundingClientRect().width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => {
    const out = [];
    markets.forEach((m) => {
      const total = Number(m.totalUSD ?? m.totals?.totalUSD ?? 0);
      const buy   = Number(m.buyUSD ?? m.buys ?? m.totals?.buyUSD ?? 0);
      const sell  = Number(m.sellUSD ?? m.sells ?? m.totals?.sellUSD ?? 0);
      const pBuy  = total > 0 ? Math.round((buy / total) * 100) : 0;
      const pSell = 100 - pBuy;
      out.push({
        id: m.conditionId || m.slug || m.title,
        title: m.title || m.slug || "Untitled",
        total, buy, sell, pBuy, pSell,
        ub: Number(m.uniqueBuyers ?? m.totals?.uniqueBuyers ?? 0),
        us: Number(m.uniqueSellers ?? m.totals?.uniqueSellers ?? 0),
      });
    });
    return out;
  }, [markets]);

  return (
    <div ref={wrapRef} style={{ width: "100%", display:"grid", gridTemplateColumns:`repeat(auto-fill, minmax(260px, 1fr))`, gap: 14 }}>
      {rows.map(r => {
        const ring = {
          background: `conic-gradient(#22c55e 0 ${r.pBuy}%, #f43f5e ${r.pBuy}% 100%)`,
          borderRadius: "50%",
          width: 120, height: 120,
          boxShadow: "inset 0 0 0 10px #0b1015, 0 2px 10px rgba(0,0,0,.35)",
          margin: "0 auto"
        };
        return (
          <div key={r.id} onClick={() => onSelect && onSelect({ conditionId: r.id })} style={{background:"#0f1520", border:"1px solid #2b3c52", borderRadius:16, padding:12, cursor:"pointer"}}>
            <div style={ring} />
            <div style={{textAlign:"center", color:"#c6cfdb", marginTop:8, fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.title}</div>
            <div style={{textAlign:"center", color:"#9ba7b4", marginTop:6, fontSize:12}}>
              {Intl.NumberFormat('en-US', {notation:'compact', style:'currency', currency:'USD', maximumFractionDigits:1}).format(r.total)}
              {" • "}{r.pBuy}%/{r.pSell}%{" • "}{r.ub}/{r.us}
            </div>
          </div>
        );
      })}
    </div>
  );
}
