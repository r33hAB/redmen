import React from "react";

function usd(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v/1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export default function DetailsModal({ market, detail, onClose }) {
  if (!market) return null;
  const totals = detail?.totals || {};
  const topBettors = Array.isArray(detail?.topBettors) ? detail.topBettors : [];
  const outcomes = detail?.outcomes || {};

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.55)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:50
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#121821", color:"#e8eef5", border:"1px solid #2b3c52", borderRadius:12, padding:16, width:720, maxHeight:"80vh", overflow:"auto"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
          <div style={{fontWeight:700, fontSize:16}}>{market.title}</div>
          <button onClick={onClose} style={{background:"#1b2431", color:"#e8eef5", border:"1px solid #2b3c52", borderRadius:8, padding:"6px 10px", cursor:"pointer"}}>Close</button>
        </div>

        <div style={{fontSize:13, color:"#9ba7b4", marginBottom:10}}>
          {`${
            usd(market.totalUSD)
          } • buys/sells ${usd(market.buyUSD||market.buys||0)}/${usd(market.sellUSD||market.sells||0)} • unique ${market.uniqueBuyers}/${market.uniqueSellers} • trades ${market.trades}`}
        </div>

        {/* Outcomes */}
        <div style={{marginBottom:12}}>
          <div style={{fontWeight:600, marginBottom:6}}>Outcomes</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:8}}>
            {Object.entries(outcomes).map(([k,v]) => (
              <div key={k} style={{background:"#0f1520", border:"1px solid #2b3c52", borderRadius:10, padding:10}}>
                <div style={{fontSize:13, color:"#9ba7b4"}}>{String(k)}</div>
                <div style={{fontSize:14, fontWeight:600}}>{usd(v.usd)} <span style={{color:"#9ba7b4"}}>• trades {v.trades}</span></div>
              </div>
            ))}
            {Object.keys(outcomes).length === 0 && <div style={{color:"#9ba7b4"}}>No outcome breakdown available.</div>}
          </div>
        </div>

        {/* Top bettors */}
        <div>
          <div style={{fontWeight:600, marginBottom:6}}>Top bettors</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:8}}>
            {topBettors.map(b => (
              <div key={b.wallet} style={{background:"#0f1520", border:"1px solid #2b3c52", borderRadius:10, padding:10}}>
                <div style={{fontSize:13, color:"#9ba7b4"}}>{b.display || b.wallet}</div>
                <div style={{fontSize:14, fontWeight:600}}>{usd(b.usd)} <span style={{color:"#9ba7b4"}}>• trades {b.trades}</span></div>
              </div>
            ))}
            {topBettors.length===0 && <div style={{color:"#9ba7b4"}}>No top bettor data available.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
