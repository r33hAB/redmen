
import React, { useEffect, useState } from "react";
import { fetchHighlights } from "../lib/highlights";

const PM_URL = import.meta?.env?.VITE_HIGHLIGHTS_PM_URL || "";
const KS_URL = import.meta?.env?.VITE_HIGHLIGHTS_KS_URL || "";

function Money({ n }) {
  if (n == null) return null;
  return <>${Number(n).toLocaleString()}</>;
}

function SummaryView({ data, label }) {
  if (!data) return <div style={{color:"#c6cfdb"}}>No data.</div>;
  const generatedAt = data.generatedAt || data.createdAt || data.time || null;
  const summary = data.highlights || data.summary || data;

  const top = summary?.markets?.topByFlow;
  const runner = summary?.markets?.runnerUpByFlow;
  const surge = summary?.markets?.biggestSurge;
  const traders = summary?.traders || {};

  return (
    <div style={{ display:"grid", gap:12 }}>
      {label && <div style={{fontWeight:800, color:"#e1eaf8"}}>{label}</div>}
      <div style={{display:"flex", gap:16, flexWrap:"wrap"}}>
        <Stat label="Markets" value={summary?.totals?.markets} />
        <Stat label="Trades" value={summary?.totals?.trades} />
        <Stat label="Unique traders" value={summary?.totals?.uniqueTraders} />
        <Stat label="Flow (USD)" value={<Money n={summary?.totals?.totalUSD} />} />
      </div>

      <Section title="Top markets by flow">
        <MarketCard item={top} />
        <MarketCard item={runner} />
      </Section>

      <Section title="Biggest surge">{surge ? <MarketCard item={surge} /> : <Empty />}</Section>

      <Section title="Notable traders">
        <TraderCard label="Top aggressor" t={traders.topAggressor} />
        <TraderCard label="Top buyer" t={traders.topBuyer} />
        <TraderCard label="Top seller" t={traders.topSeller} />
      </Section>

      {generatedAt && (
        <div style={{opacity:0.5, fontSize:12}}>Updated {new Date(generatedAt).toLocaleString()}</div>
      )}
    </div>
  );
}

export default function Highlights({ hours=1 }) {
  const [dataPM, setDataPM] = useState(null);
  const [dataKS, setDataKS] = useState(null);
  const [single, setSingle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (PM_URL && KS_URL) {
          const [pm, ks] = await Promise.all([
            fetchDirect(PM_URL, { hours }),
            fetchDirect(KS_URL, { hours })
          ]);
          if (!cancelled) { setDataPM(pm); setDataKS(ks); setSingle(null); setError(null); }
        } else {
          const json = await fetchHighlights({ hours });
          if (!cancelled) { setSingle(json); setDataPM(null); setDataKS(null); setError(null); }
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hours]);

  if (loading) return <div style={{color:"#c6cfdb"}}>Loading highlights…</div>;
  if (error) return <div style={{color:"#e57373"}}>Failed to load: {String(error?.message||error)}</div>;

  if (single) return <SummaryView data={single} />;

  return (
    <div style={{display:"grid", gap:16}}>
      <div style={{display:"grid", gap:16, gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))"}}>
        <div><SummaryView data={dataPM} label="Polymarket" /></div>
        <div><SummaryView data={dataKS} label="Kalshi" /></div>
      </div>
    </div>
  );
}

async function fetchDirect(base, params = {}) {
  const url = new URL(base, window.location.origin);
  Object.entries(params || {}).forEach(([k,v]) => {
    if (v!=null && v!=="") url.searchParams.set(k, String(v));
  });
  const r = await fetch(url.toString(), { headers: { "Accept":"application/json" }});
  if (!r.ok) throw new Error(`Highlights HTTP ${r.status}`);
  return r.json();
}

function Stat({ label, value }) {
  return (
    <div style={{minWidth:140, padding:"10px 12px", border:"1px solid #2b3c52", borderRadius:12, background:"#0f1724", color:"#e1eaf8"}}>
      <div style={{opacity:0.7, fontSize:12}}>{label}</div>
      <div style={{fontSize:18, fontWeight:700}}>{value ?? "-"}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div>
      <div style={{fontWeight:700, marginBottom:8, color:"#e1eaf8"}}>{title}</div>
      <div style={{display:"grid", gap:10}}>{children}</div>
    </div>
  );
}
function Empty(){ return <div style={{opacity:0.7}}>—</div>; }
function MarketCard({ item }) {
  if (!item) return <Empty />;
  return (
    <div style={{border:"1px solid #2b3c52", borderRadius:12, padding:12, background:"#0f1724"}}>
      <div style={{fontWeight:600, marginBottom:6, color:"#e1eaf8"}}>{item.title || item.name || item.slug}</div>
      <div style={{opacity:0.9}}>
        <b>Flow:</b> <Money n={item.totalUSD} /> · <b>Trades:</b> {item.trades} · <b>Unique:</b> {item.uniqueCount}
      </div>
    </div>
  );
}
function TraderCard({ label, t }) {
  if (!t) return <Empty />;
  return (
    <div style={{border:"1px solid #2b3c52", borderRadius:12, padding:12, background:"#0f1724"}}>
      <div style={{fontWeight:600, marginBottom:6, color:"#e1eaf8"}}>{label}</div>
      <div style={{opacity:0.9}}>
        <b>Trader:</b> {t.handle || t.trader || t.id || t.wallet} · <b>Flow:</b> <Money n={t.totalUSD} /> · <b>Trades:</b> {t.trades}
      </div>
    </div>
  );
}
