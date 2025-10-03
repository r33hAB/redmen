// src/components/DetailsModal.jsx
import React, { useMemo } from "react";
import Sparkline from "./Sparkline.jsx";
import { yesNoLabels, sourceBadge } from "../lib/badge.js";

function inferSource(market, detail) {
  const s = String(market?.source || detail?.source || "").toLowerCase();
  if (s === "polymarket" || s === "kalshi") return s;
  const id = String(market?.conditionId || market?.id || "");
  const slug = String(market?.slug || "");
  if (/^0x[a-f0-9]{64}$/i.test(id)) return "polymarket";
  if (/^(kx|kxmlb)/i.test(slug) || slug.includes("kxmlb") || (id && id.includes("-"))) return "kalshi";
  return "unknown";
}

const HOUR = 3600;
const nowSec = () => Math.floor(Date.now() / 1000);

function safeUSD(t){
  const size = Number(t?.size ?? 0) || 0;
  const price = Number.isFinite(Number(t?.price)) ? Number(t?.price) : 1;
  const given = Number(t?.usd ?? t?.totalUSD ?? t?.amountUSD ?? t?.sizeUSD ?? 0);
  return given > 0 ? given : Math.max(0, size * price);
}

// --- Polymarket mapping: BUY/SELL x YES/NO -> backed team -------------------
function pmBackedTeam(t, labels){
  const side = String(t?.side || "").toUpperCase();
  const outc = String(t?.outcome || t?.outcomeLabel || t?.label || "").toLowerCase();
  const isBuy = side === "BUY";
  const isOutcomeYes = outc === "yes";
  const backYes = (isOutcomeYes && isBuy) || (!isOutcomeYes && !isBuy);
  return backYes ? labels.yes : labels.no;
}

// --- Kalshi mapping (YES-only): BUY -> YES team, SELL -> other --------------
function kalshiBackedTeam(t, labels){
  const side = String(t?.side || "").toUpperCase();
  return side === "SELL" ? labels.no : labels.yes;
}

function bucketByTeam(trades, labels, teamFn){
  const start = nowSec() - HOUR;
  const binsA = new Array(12).fill(0);
  const binsB = new Array(12).fill(0);
  let totalA=0, totalB=0, buy=0, sell=0;

  for(const t of (trades||[])){
    const ts = Number(t?.timestamp || t?.ts || 0) || 0;
    if (!ts || ts < start) continue;
    const usd = safeUSD(t);
    const team = teamFn(t, labels);
    const idx = Math.min(11, Math.max(0, Math.floor((ts - start)/300)));
    if (team === labels.yes){ binsA[idx]+=usd; totalA+=usd; } else { binsB[idx]+=usd; totalB+=usd; }
    const side = String(t?.side || "").toUpperCase();
    if (side === "BUY") buy += usd; else if (side === "SELL") sell += usd;
  }

  return {
    binsA, binsB, totals: [
      { label: labels.yes, usd: totalA },
      { label: labels.no,  usd: totalB },
    ],
    buySell: { buy, sell },
  };
}

export default function DetailsModal({
  market, detail, onClose,
  watchlistMarkets=new Set(), onToggleWatchMarket=()=>{}
}) {
  const source = inferSource(market, detail);
  const t = market?.totals || {};
  const labels = yesNoLabels(market);
  const rawTrades = detail?.market?.trades || detail?.trades || [];
  const tradesCount = Number(market?.trades ?? t.trades ?? (rawTrades?.length || 0)) || 0;

  // ---- Combine the “working” pieces ----------------------------------------
  // Polymarket: compute totals & bins from trades attribution (pmBackedTeam)
  // Kalshi:     *totals* come from market-level buy/sell (which map 1:1 to YES/NO),
  //             *bins* from trades attribution (kalshiBackedTeam)
  const pmComputed   = useMemo(() => bucketByTeam(rawTrades, labels, pmBackedTeam),     [rawTrades, labels]);
  const kxComputed   = useMemo(() => bucketByTeam(rawTrades, labels, kalshiBackedTeam), [rawTrades, labels]);

  const outcomes = useMemo(() => {
    if (source === "kalshi") {
      const buy = Number(market?.buyUSD ?? t.buyUSD ?? 0) || 0;
      const sell= Number(market?.sellUSD?? t.sellUSD?? 0) || 0;
      return [
        { label: labels.yes, usd: buy },
        { label: labels.no,  usd: sell },
      ];
    }
    return pmComputed.totals;
  }, [source, market, t, labels, pmComputed]);

  const flowBins = source === "kalshi" ? kxComputed : pmComputed;
  const buySellChip = useMemo(() => {
    if (source === "kalshi") {
      return {
        buy:  Number(market?.buyUSD ?? t.buyUSD ?? 0) || 0,
        sell: Number(market?.sellUSD?? t.sellUSD?? 0) || 0,
      };
    }
    return pmComputed.buySell;
  }, [source, market, t, pmComputed]);

  const totalUSD = Number(market?.totalUSD ?? t.totalUSD ?? (buySellChip.buy + buySellChip.sell) ?? 0) || 0;

  const series = detail?.prices || detail?.price1h || detail?.priceSeries || [];
  const spark = (Array.isArray(series) && series.length >= 2) ? series.map(Number) : [];

  const id = market?.conditionId;
  const isWatchedMarket = id && watchlistMarkets.has(id);
  const badge = sourceBadge({ ...market, source });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)" }} />
      <div style={{ position:"relative", background:"#0f1823", color:"#e6edf5", border:"1px solid #2b3c52", borderRadius:12, width:"min(980px, 96vw)", maxHeight:"88vh", overflow:"auto", zIndex:2001 }}>
        {/* Header */}
        <div style={{ padding:16, borderBottom:"1px solid #223247", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"#0f1823", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <div style={{ fontWeight:700 }}>{market?.title || market?.slug || "Market"}</div>
            <span style={{ background:"#1b2738", border:"1px solid #2b3c52", borderRadius:999, padding:"4px 10px", color:"#c6cfdb", fontSize:12 }}>{badge}</span>
            <button onClick={() => onToggleWatchMarket(id)} style={{ background:isWatchedMarket ? "#244f2e" : "#1b2738", color:"#c6cfdb", border:"1px solid #2b3c52", borderRadius:999, padding:"4px 10px", cursor:"pointer", fontSize:12 }}>
              {isWatchedMarket ? "★ Watch market" : "☆ Watch market"}
            </button>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <a href={source === "polymarket" ? `https://polymarket.com/market/${market?.slug || market?.conditionId || ""}` : `https://kalshi.com/market/${market?.slug || market?.conditionId || ""}`}
               target="_blank" rel="noreferrer" style={{ textDecoration:"none" }}>
              <button style={{ background:"#1b2738", color:"#c6cfdb", border:"1px solid #2b3c52", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}>
                Open on {source === "polymarket" ? "Polymarket" : "Kalshi"}
              </button>
            </a>
            <button onClick={onClose} style={{ background:"#172334", color:"#c6cfdb", border:"1px solid #2b3c52", borderRadius:8, padding:"6px 10px", cursor:"pointer" }}>Close</button>
          </div>
        </div>

        {/* Sparkline */}
        <div style={{ padding:16, borderBottom:"1px solid #223247" }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Last hour price</div>
          <Sparkline points={spark} width={720} height={72} />
        </div>

        {/* Chips */}
        <div style={{ padding:16, display:"flex", gap:8, flexWrap:"wrap" }}>
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>${Math.round(totalUSD).toLocaleString()}</span>
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>
            buys/sells ${Math.round(buySellChip.buy).toLocaleString()}/{Math.round(buySellChip.sell).toLocaleString()}
          </span>
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>trades {tradesCount}</span>
        </div>

        {/* Outcomes */}
        <div style={{ padding:16, borderTop:"1px solid #223247" }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Money placed (last hour)</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {outcomes.map((o) => (
              <div key={o.label} style={{ display:"contents" }}>
                <div style={{ background:"#0b1520", border:"1px solid #223247", borderRadius:8, padding:"8px 10px" }}>{o.label}</div>
                <div style={{ textAlign:"right", background:"#0b1520", border:"1px solid #223247", borderRadius:8, padding:"8px 10px" }}>${Math.round(o.usd||0).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, fontSize:12, color:"#9fb0c7" }}>
            Mapping: PM BUY/SELL × YES/NO → backed team. Kalshi: BUY→{labels.yes}, SELL→{labels.no}.
          </div>
        </div>

        {/* Flow by outcome bars */}
        <div style={{ padding:16, borderTop:"1px solid #223247" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontWeight:600 }}>Flow by team (5‑min buckets)</div>
            <div style={{ fontSize:12, color:"#9fb0c7" }}>
              <span style={{ marginLeft: 12 }}><span style={{ display:"inline-block", width:10, height:10, background:"#22c55e", borderRadius:2, marginRight:6 }} />{labels.yes}</span>
              <span style={{ marginLeft: 12 }}><span style={{ display:"inline-block", width:10, height:10, background:"#ef4444", borderRadius:2, marginRight:6 }} />{labels.no}</span>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:4 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (flowBins.binsA?.[i] || 0);
              const b = (flowBins.binsB?.[i] || 0);
              const total = a + b || 1;
              const ah = Math.round((a / total) * 100);
              const bh = 100 - ah;
              return (
                <div key={i} style={{ display:"grid", gridTemplateRows:`${ah}fr ${bh}fr`, height:60, background:"#0b1520", border:"1px solid #223247", borderRadius:4, overflow:"hidden" }}>
                  <div title={`${labels.yes} $${Math.round(a).toLocaleString()}`} style={{ background:"#22c55e" }} />
                  <div title={`${labels.no}  $${Math.round(b).toLocaleString()}`} style={{ background:"#ef4444" }} />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding:16, borderTop:"1px solid #223247", color:"#9fb0c7" }}>
          Trader identities aren’t available on Kalshi due to privacy rules; top bettors list is shown only for Polymarket.
        </div>
      </div>
    </div>
  );
}
