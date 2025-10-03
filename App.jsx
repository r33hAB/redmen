import React, { useEffect, useMemo, useState } from "react";
import { fetchSportsEvents, fetchMarketDetail } from "./lib/api.js";

import DebugPanel from "./components/DebugPanel.jsx";
import MarketCard from "./components/MarketCard.jsx";
import BubbleBoard from "./components/BubbleBoard.jsx";
import BubbleHeatmap from "./components/BubbleHeatmap.jsx";
import DetailsModal from "./components/DetailsModal.jsx";
import HoursToggle from "./components/HoursToggle.jsx";
import SmartTeamPicker from "./components/SmartTeamPicker.jsx";
import SourceToggle from "./components/SourceToggle.jsx";
import MarketsList from "./components/MarketList.jsx";

const VIEWS = ["Board", "Heatmap", "List"];

export default function App() {
  function inferSource(m) {
    try {
      const s = String(m?.source ?? "").toLowerCase();
      if (s === "polymarket" || s === "kalshi") return s;
      const id = String(m?.conditionId ?? m?.id ?? "");
      const slug = String(m?.slug ?? "");
      if (/^0x[a-f0-9]{64}$/i.test(id)) return "polymarket";
      if (/^(kx|kxmlb)/i.test(slug) || slug.includes("kxmlb") || (id && id.includes("-"))) return "kalshi";
    } catch {}
    return "unknown";
  }

  const [markets, setMarkets] = useState([]);
  const [sources, setSources] = useState({ polymarket: true, kalshi: true });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(VIEWS[0]);
  const [hours, setHours] = useState(24);

  // Search + team filter
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [onlyTeam, setOnlyTeam] = useState(true);
  const [greyOthers, setGreyOthers] = useState(false);

  function log(obj) { try { setLogs((L) => [...L.slice(-500), obj]); } catch {} }

  async function load() {
    setBusy(true); setError(null);
    try {
      const baseParams = { hours, minUsd: 100, takerOnly: true };
      let params = { ...baseParams };
      if (sources.polymarket && !sources.kalshi) params.source = "polymarket";
      else if (!sources.polymarket && sources.kalshi) params.source = "kalshi";

      const r = await fetchSportsEvents(params);
      const src = Array.isArray(r) ? r
        : Array.isArray(r?.markets) ? r.markets
        : Array.isArray(r?.data) ? r.data
        : [];

      const list = src.map((m) => {
        const t = m.totals || {};
        return {
          conditionId: m.conditionId ?? m.slug ?? m.title ?? null,
          slug: m.slug || "",
          title: m.title || "",
          totalUSD: m.totalUSD ?? t.totalUSD ?? 0,
          buyUSD:   m.buyUSD   ?? m.buys  ?? t.buyUSD  ?? 0,
          sellUSD:  m.sellUSD  ?? m.sells ?? t.sellUSD ?? 0,
          uniqueBuyers:  m.uniqueBuyers  ?? t.uniqueBuyers  ?? 0,
          uniqueSellers: m.uniqueSellers ?? t.uniqueSellers ?? 0,
          trades: Number(t.trades ?? m.trades ?? 0) || 0,
          source: String(m.source || (params.source || inferSource(m))).toLowerCase(),
        };
      });

      setMarkets(list);
      setBusy(false);
    } catch (err) {
      setError(String(err?.message || err));
      setBusy(false);
    }
  }

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [hours, sources]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedId) { setSelectedMarket(null); setSelectedDetail(null); return; }
      const m = markets.find(x => x.conditionId === selectedId);
      setSelectedMarket(m || null);
      try {
        const d = await fetchMarketDetail(selectedId, { hours: 6 });
        if (!cancelled) setSelectedDetail(d || null);
      } catch (e) {
        log({ tag:"detail", error: String(e?.message || e) });
        if (!cancelled) setSelectedDetail(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, markets]);

  const highlightText = (team || query || "").trim();
  const filtered = useMemo(() => {
    let arr = Array.isArray(markets) ? markets : [];
    if (onlyTeam && highlightText) {
      const ht = highlightText.toLowerCase();
      arr = arr.filter(m => String(m.title || "").toLowerCase().includes(ht));
    }
    return arr;
  }, [markets, highlightText, onlyTeam]);

  return (
    <div className="app-shell">
      {error && (
        <div style={{background:"#3b1f1f",border:"1px solid #6b2f2f",color:"#f2c6c6",padding:10,borderRadius:8,marginBottom:12}}>
          {String(error)}
        </div>
      )}

      <div className="h1">Redmen — Sports Flow</div>

      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
        <SourceToggle selected={sources} onChange={setSources} />
        <div style={{ marginLeft: 'auto' }}>
          <HoursToggle hours={hours} onChange={setHours} />
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns: "1fr auto auto", gap: 12 }}>
        <input
          placeholder="Search markets…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ background:"#0b1520", color:"#e6edf5", border:"1px solid #2b3c52", borderRadius:10, padding:"8px 12px" }}
        />
        <label style={{ display:"inline-flex", alignItems:"center", gap:8, color:"#c6cfdb" }}>
          <input type="checkbox" checked={greyOthers} onChange={e => setGreyOthers(e.target.checked)} />
          Grey others
        </label>
        <label style={{ display:"inline-flex", alignItems:"center", gap:8, color:"#c6cfdb" }}>
          <input type="checkbox" checked={onlyTeam} onChange={e => setOnlyTeam(e.target.checked)} />
          Only this team
        </label>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:12, marginTop:12 }}>
        {VIEWS.map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding:"8px 12px", borderRadius:10, border:"1px solid #2b3c52",
              background: v===view ? "#1b2738" : "transparent",
              color:"#c6cfdb", fontSize:13, cursor:"pointer"
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {(!busy && filtered.length === 0) && (
        <div style={{padding:24, color:"#a8b3c5"}}>No markets match the current filters.</div>
      )}

      {view === "Board" && (
        <BubbleBoard
          markets={filtered}
          highlightText={highlightText}
          greyOthers={greyOthers}
          onSelect={({ conditionId }) => setSelectedId(conditionId)}
        />
      )}

      {view === "Heatmap" && (
        <BubbleHeatmap
          markets={filtered}
          highlightText={highlightText}
          greyOthers={greyOthers}
          onSelect={({ conditionId }) => setSelectedId(conditionId)}
        />
      )}

      {view === "List" && (
        <MarketsList
          markets={filtered}
          highlightText={highlightText}
          greyOthers={greyOthers}
          onRowClick={(m) => setSelectedId(m.conditionId)}
        />
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
