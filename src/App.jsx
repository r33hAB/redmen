import React, { useEffect, useMemo, useState } from "react";
import { fetchSportsEvents, fetchMarketDetail } from "./lib/api.js";

import DebugPanel from "./components/DebugPanel.jsx";
import MarketCard from "./components/MarketCard.jsx";
import BubbleBoard from "./components/BubbleBoard.jsx";
import BubbleHeatmap from "./components/BubbleHeatmap.jsx";
import DetailsModal from "./components/DetailsModal.jsx";
import HoursToggle from "./components/HoursToggle.jsx";
import SmartTeamPicker from "./components/SmartTeamPicker.jsx";
import MarketsList from "./components/MarketList.jsx";


const VIEWS = ["Board", "Heatmap", "List"];

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(VIEWS[0]);
  const [hours, setHours] = useState(24);

  // Search and team highlight/filter state
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [onlyTeam, setOnlyTeam] = useState(true);

  function log(obj) { setLogs((L) => [...L.slice(-500), obj]); }

  async function load() {
    setBusy(true); setError(null);
    try {
      const r = await fetchSportsEvents({ hours, minUsd: 100, takerOnly: true });
      const src = Array.isArray(r) ? r : Array.isArray(r?.markets) ? r.markets : Array.isArray(r?.data) ? r.data : [];
      const list = src.map((m) => {
        const t = m.totals || {};
        return {
          conditionId: m.conditionId ?? m.slug ?? m.title ?? null,
          slug: m.slug || "",
          title: m.title || "",
          totalUSD: m.totalUSD ?? t.totalUSD ?? 0,
          buyUSD:   m.buys ?? t.buyUSD ?? 0,
          sellUSD:  m.sells ?? t.sellUSD ?? 0,
          uniqueBuyers:  m.uniqueBuyers ?? t.uniqueBuyers ?? 0,
          uniqueSellers: m.uniqueSellers ?? t.uniqueSellers ?? 0,
          activityScore: m.activityScore ?? 0,
          trades:        m.trades ?? t.trades ?? 0,
        };
      });
      setMarkets(list);
      log({ label: "markets", count: list.length });
    } catch (e) {
      const msg = e?.message || String(e);
      setError(msg); log({ label: "load:error", error: msg });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [hours]);

  // Derived/filtered markets for view based on search & team inputs
  const marketsFiltered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const t = (team || "").trim().toLowerCase();
    return markets.filter(m => {
      const hay = `${m.title} ${m.slug}`.toLowerCase();
      const qOk = q ? hay.includes(q) : true;
      const teamOk = onlyTeam && t ? hay.includes(t) : true;
      return qOk && teamOk;
    });
  }, [markets, query, team, onlyTeam]);

  const selectedMarket = useMemo(
    () => markets.find((m) => m.conditionId === selectedId) || null,
    [selectedId, markets]
  );

  useEffect(() => {
    (async () => {
      if (!selectedId) { setSelectedDetail(null); return; }
      try {
        const json = await fetchMarketDetail(selectedId, { hours: 24 });
        setSelectedDetail(json?.market || null);
      } catch (e) {
        log({ label: "detail:error", error: e?.message || String(e) });
        setSelectedDetail(null);
      }
    })();
  }, [selectedId]);

  return (
    <div className="app-shell">
      <div className="h1">Redmen — Sports Flow</div>

      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {VIEWS.map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding:"8px 12px", borderRadius:10, border:"1px solid #2b3c52",
              background: v===view ? "#1b2431" : "#121821",
              color:"#e8eef5", cursor:"pointer"
            }}
          >{v}</button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search markets…"
            style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #2b3c52", background:"#0f1520", color:"#e6edf5", minWidth:220 }}
          />
          <HoursToggle value={hours} onChange={setHours} />
        </div>

        <SmartTeamPicker
          markets={markets}
          value={team}
          onChange={setTeam}
          onlySelected={onlyTeam}
          onOnlyChange={setOnlyTeam}
        />
    </div>

      {error && <div style={{color:"crimson", marginBottom: 8}}>Error: {error}</div>}
      {busy && <div style={{opacity:0.7}}>Loading…</div>}

       {view === "List" && (
   <MarketsList highlightText={team} greyOthers={!team || !onlyTeam ? false : true}
     markets={marketsFiltered}
     onSelect={(m) => setSelectedId(m.conditionId)}
     selectedSlug={selectedId}
   />
 )}

      {view === "Board" && (
        <div className="section">
          <BubbleBoard highlightText={team} greyOthers={!team || !onlyTeam ? false : true} markets={marketsFiltered} onSelect={(m) => setSelectedId(m.conditionId)} selectedSlug={selectedId} />
        </div>
      )}

      {view === "Heatmap" && (
        <div className="section">
          <BubbleHeatmap highlightText={team} greyOthers={!team || !onlyTeam ? false : true} markets={marketsFiltered} onSelect={(m) => setSelectedId(m.conditionId)} selectedId={selectedId} />
        </div>
      )}

      {selectedMarket && (
        <DetailsModal
          market={selectedMarket}
          detail={selectedDetail}
          onClose={() => setSelectedId(null)}
        />
      )}

      <DebugPanel open={false} logs={logs} onClear={() => setLogs([])} />
    </div>
  );
}
