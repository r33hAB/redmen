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

// Polymarket: (outcome=Yes & BUY) => Yes, (outcome=Yes & SELL) => No,
//             (outcome=No & BUY)  => No,  (outcome=No & SELL)  => Yes.
// USD = usd|totalUSD|amountUSD|sizeUSD fallback to size*price.
// Kalshi: trades are on YES contract; SELL(YES) => No.
function normalizeTradesBinary(trades = [], source = "unknown") {
  const out = [];
  for (const t of (trades || [])) {
    const side = String(t?.side || "").toUpperCase();
    const outc = String(t?.outcome || t?.outcomeLabel || t?.label || "").toLowerCase();
    let label;
    let usd = 0;

    if (source === "polymarket") {
      const isBuy = side === "BUY";
      const isYes = (outc === "yes" && isBuy) || (outc === "no" && !isBuy);
      label = isYes ? "Yes" : "No";
      const size = Number(t?.size ?? 0) || 0;
      const price = Number.isFinite(Number(t?.price)) ? Number(t?.price) : 1;
      const givenUsd = Number(t?.usd ?? t?.totalUSD ?? t?.amountUSD ?? t?.sizeUSD ?? 0);
      usd = givenUsd > 0 ? givenUsd : Math.max(0, size * price);
    } else {
      let isYes = true;
      if (outc === "no") isYes = false;
      if (side === "SELL") isYes = !isYes;
      label = isYes ? "Yes" : "No";
      usd = Number(t?.usd ?? t?.totalUSD ?? t?.amountUSD ?? t?.sizeUSD ?? t?.size ?? 0) || 0;
      if (usd < 0) usd = Math.abs(usd);
    }

    const ts = Number(t?.timestamp || t?.ts || 0) || 0;
    out.push({ ts, usd, label });
  }
  return out;
}

function sumByLabel(rows = []) {
  const acc = { Yes: 0, No: 0 };
  for (const r of rows) acc[r.label] = (acc[r.label] || 0) + (Number(r.usd) || 0);
  return [{ label: "Yes", usd: acc.Yes }, { label: "No", usd: acc.No }];
}

function bucketLastHourByLabel(rows = []) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 3600;
  const bins = { Yes: new Array(12).fill(0), No: new Array(12).fill(0) };
  for (const r of rows) {
    const ts = Number(r?.ts || 0);
    if (!ts || ts < start) continue;
    const i = Math.min(11, Math.max(0, Math.floor((ts - start) / 300)));
    bins[r.label === "No" ? "No" : "Yes"][i] += Number(r.usd) || 0;
  }
  return { series: [{ label: "Yes", bins: bins.Yes }, { label: "No", bins: bins.No }] };
}

export default function DetailsModal({
  market, detail,
  watchlistMarkets = new Set(), watchlistTeams = new Set(),
  onToggleWatchMarket = () => {}, onToggleWatchTeam = () => {}, onClose
}) {
  const source = inferSource(market, detail);
  const t = market?.totals || {};
  const totalUSD = Number(market?.totalUSD ?? t.totalUSD ?? 0) || 0;
  const buyUSD   = Number(market?.buyUSD   ?? t.buyUSD   ?? 0) || 0;
  const sellUSD  = Number(market?.sellUSD  ?? t.sellUSD  ?? 0) || 0;
  const trades   = Number(market?.trades ?? t.trades ?? (detail?.trades?.length || 0)) || 0;

  const normalized = useMemo(() => {
    const raw = detail?.market?.trades || detail?.trades || [];
    return normalizeTradesBinary(raw, source);
  }, [detail, source]);

  const outcomesRaw = useMemo(() => sumByLabel(normalized), [normalized]);
  const labels = yesNoLabels(market);
  const outcomes = useMemo(() => outcomesRaw.map(o => ({
    label: o.label === "Yes" ? labels.yes : labels.no,
    usd: o.usd
  })), [outcomesRaw, labels]);

  const flowOutcome = useMemo(() => bucketLastHourByLabel(normalized), [normalized]);
  const spark = useMemo(() => {
    const series = detail?.prices || detail?.price1h || detail?.priceSeries || [];
    return (Array.isArray(series) && series.length >= 2) ? series.map(Number) : [];
  }, [detail]);

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
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>buys/sells ${Math.round(buyUSD).toLocaleString()}/{Math.round(sellUSD).toLocaleString()}</span>
          <span style={{ background:"#172334", border:"1px solid #2b3c52", borderRadius:999, padding:"6px 10px"}}>trades {trades}</span>
        </div>

        {/* Outcomes */}
        <div style={{ padding:16, borderTop:"1px solid #223247" }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Outcomes</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {outcomes.map((o) => (
              <div key={o.label} style={{ display:"contents" }}>
                <div style={{ background:"#0b1520", border:"1px solid #223247", borderRadius:8, padding:"8px 10px" }}>{o.label}</div>
                <div style={{ textAlign:"right", background:"#0b1520", border:"1px solid #223247", borderRadius:8, padding:"8px 10px" }}>${Math.round(o.usd||0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Flow by outcome bars */}
        <div style={{ padding:16, borderTop:"1px solid #223247" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontWeight:600 }}>Flow by outcome (5‑min buckets)</div>
            <div style={{ fontSize:12, color:"#9fb0c7" }}>
              <span style={{ marginLeft: 12 }}><span style={{ display:"inline-block", width:10, height:10, background:"#22c55e", borderRadius:2, marginRight:6 }} />Yes</span>
              <span style={{ marginLeft: 12 }}><span style={{ display:"inline-block", width:10, height:10, background:"#ef4444", borderRadius:2, marginRight:6 }} />No</span>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(12, 1fr)", gap:4 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const a = flowOutcome.series[0]?.bins[i] || 0;
              const b = flowOutcome.series[1]?.bins[i] || 0;
              const total = a + b || 1;
              const ah = Math.round((a / total) * 100);
              const bh = 100 - ah;
              return (
                <div key={i} style={{ display:"grid", gridTemplateRows:`${ah}fr ${bh}fr`, height:60, background:"#0b1520", border:"1px solid #223247", borderRadius:4, overflow:"hidden" }}>
                  <div title={`Yes $${Math.round(a).toLocaleString()}`} style={{ background:"#22c55e" }} />
                  <div title={`No $${Math.round(b).toLocaleString()}`} style={{ background:"#ef4444" }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Traders note */}
        <div style={{ padding:16, borderTop:"1px solid #223247", color:"#9fb0c7" }}>
          Trader identities aren’t available on Kalshi due to privacy rules; top bettors list is shown only for Polymarket.
        </div>
      </div>
    </div>
  );
}
