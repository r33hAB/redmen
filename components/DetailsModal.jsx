import React from "react";

function inferSource(market, detail) {
  const s = String(market?.source || detail?.source || "").toLowerCase();
  if (s === "polymarket" || s === "kalshi") return s;
  const id = String(market?.conditionId || market?.id || "");
  const slug = String(market?.slug || "");
  if (/^0x[a-f0-9]{64}$/i.test(id)) return "polymarket";
  if (/^(kx|kxmlb)/i.test(slug) || slug.includes("kxmlb") || (id && id.includes("-"))) return "kalshi";
  return "unknown";
}

function normalizeOutcomes(src) {
  if (!src) return [];
  if (Array.isArray(src)) {
    return src.map(o => {
      const label = o?.label ?? o?.name ?? o?.outcome ?? o?.answer ?? "";
      const usd = Number(o?.usd ?? o?.totalUSD ?? o?.flowUSD ?? o?.amountUSD ?? 0) || 0;
      return label ? { label, usd } : null;
    }).filter(Boolean);
  }
  if (typeof src === "object") {
    return Object.entries(src).map(([label, v]) => {
      const usd = typeof v === "number" ? v : Number(v?.usd ?? v?.totalUSD ?? v?.flowUSD ?? v?.amountUSD ?? 0) || 0;
      return label ? { label, usd } : null;
    }).filter(Boolean);
  }
  return [];
}

function outcomesFromTrades(detail) {
  const trades = detail?.market?.trades || detail?.trades || [];
  if (!Array.isArray(trades) || trades.length === 0) return [];
  const acc = new Map();
  for (const t of trades) {
    const label =
      t?.outcome ?? t?.outcomeLabel ?? t?.label ?? t?.answer ?? t?.selection ?? t?.sideLabel ?? t?.side ?? "";
    if (!label) continue;
    const usd = Number(t?.usd ?? t?.totalUSD ?? t?.flowUSD ?? t?.amountUSD ?? t?.sizeUSD ?? t?.size ?? 0) || 0;
    acc.set(label, (acc.get(label) || 0) + usd);
  }
  return Array.from(acc, ([label, usd]) => ({ label, usd }));
}

function tradersFromTrades(detail) {
  const trades = detail?.market?.trades || detail?.trades || [];
  if (!Array.isArray(trades) || trades.length === 0) return [];
  const acc = new Map();
  for (const t of trades) {
    const name =
      t?.display || t?.name || t?.username || t?.pseudonym || t?.user || t?.addr || t?.address || t?.wallet || "";
    if (!name) continue;
    const usd = Number(t?.usd ?? t?.totalUSD ?? t?.flowUSD ?? t?.amountUSD ?? t?.sizeUSD ?? t?.size ?? 0) || 0;
    acc.set(name, (acc.get(name) || 0) + usd);
  }
  return Array.from(acc, ([name, usd]) => ({ name, usd })).sort((a,b)=>b.usd-a.usd);
}

export default function DetailsModal({ market, detail, onClose }) {
  const source = inferSource(market, detail);

  const t = market?.totals || {};
  const totalUSD = Number(market?.totalUSD ?? t.totalUSD ?? 0) || 0;
  const buyUSD   = Number(market?.buyUSD   ?? t.buyUSD   ?? 0) || 0;
  const sellUSD  = Number(market?.sellUSD  ?? t.sellUSD  ?? 0) || 0;
  const trades   = Number(market?.trades ?? t.trades ?? detail?.trades?.length ?? 0) || 0;
  const uniqBuy  = Number(market?.uniqueBuyers ?? t.uniqueBuyers ?? 0) || 0;
  const uniqSell = Number(market?.uniqueSellers ?? t.uniqueSellers ?? 0) || 0;

  const explicitOutcomes = normalizeOutcomes(detail?.market?.outcomeTotals || detail?.outcomeTotals || market?.outcomes);
  const outcomes = explicitOutcomes.length ? explicitOutcomes : outcomesFromTrades(detail);

  const topBettors = source === "kalshi" ? [] : tradersFromTrades(detail);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)" }} />
      <div style={{ position:"relative", background:"#0f1823", color:"#e6edf5", border:"1px solid #2b3c52", borderRadius:12, width:"min(960px, 94vw)", maxHeight:"85vh", overflow:"auto", zIndex:2001 }}>
        <div style={{ padding:16, borderBottom:"1px solid #223247", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"#0f1823", zIndex:1 }}>
          <div style={{ fontWeight:700 }}>{market?.title || market?.slug || "Market"}</div>
          <button onClick={onClose} style={{ background:"#172334", color:"#c6cfdb", border:"1px solid #2b3c52", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}>Close</button>
        </div>

        <div style={{ padding:16, display:"flex", gap:8, flexWrap:"wrap" }}>
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>${totalUSD.toLocaleString()}</span>
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>buys/sells ${buyUSD.toLocaleString()}/${sellUSD.toLocaleString()}</span>
          {source !== "kalshi" && (
            <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>unique {uniqBuy}/{uniqSell}</span>
          )}
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>trades {trades}</span>
        </div>

        <div style={{ padding:16, borderTop:"1px solid #223247" }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Outcomes</div>
          {outcomes.length >= 2 ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {outcomes.map((o) => (
                <div key={o.label} style={{ display:"flex", justifyContent:"space-between", background:"#0b1520", border:"1px solid #223247", borderRadius:8, padding:"8px 10px" }}>
                  <span>{o.label}</span>
                  <span>${(o.usd||0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color:"#9fb0c7" }}>No outcome breakdown available.</div>
          )}
        </div>

        <div style={{ padding:16, borderTop:"1px solid #223247" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontWeight:600 }}>Top bettors</div>
            {source === "kalshi" && (
              <div style={{ fontSize:12, color:"#9fb0c7", display:"inline-flex", gap:8, alignItems:"center" }}>
                <span style={{ display:"inline-block", width:8, height:8, borderRadius:999, background:"#f59e0b" }} />
                Trader identities aren’t available on Kalshi due to privacy rules.
              </div>
            )}
          </div>

          {source === "kalshi" ? (
            <div style={{ marginTop:8, color:"#9fb0c7" }}>
              You’ll see aggregate flows and outcomes above, but no per-trader names or rankings for Kalshi markets.
            </div>
          ) : topBettors.length ? (
            <div style={{ marginTop:8, display:"grid", gridTemplateColumns:"1fr auto", gap:6 }}>
              {topBettors.slice(0, 12).map((t) => (
                <div key={t.name} style={{ display:"contents" }}>
                  <div style={{ background:"#0b1520", border:"1px solid #223247", borderRadius:8, padding:"8px 10px" }}>{t.name}</div>
                  <div style={{ textAlign:"right", background:"#0b1520", border:"1px solid #223247", borderRadius:8, padding:"8px 10px" }}>${t.usd.toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginTop:8, color:"#9fb0c7" }}>No top bettor data for this window.</div>
          )}
        </div>
      </div>
    </div>
  );
}
