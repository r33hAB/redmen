import React, { useEffect, useMemo, useState } from "react";
import { fetchSportsEvents, fetchMarketDetail } from "./lib/api.js";

import DebugPanel from "./components/DebugPanel.jsx";
import BubbleBoard from "./components/BubbleBoard.jsx";
import BubbleHeatmap from "./components/BubbleHeatmap.jsx";
import DetailsModal from "./components/DetailsModal.jsx";
import SourceToggle from "./components/SourceToggle.jsx";
import MarketList from "./components/MarketList.jsx";
import Toaster from "./components/Toaster.jsx";
import { minuteBins1h, zscore5v30 } from "./lib/bucket.js";

const VIEWS = ["Board", "Heatmap", "List"];
const FIXED_HOURS = 1;

// heuristic: extract team-like tokens from a title
function extractTeamsFromTitle(title = "") {
  const t = String(title).replace(/\s+/g, " ").trim();
  if (!t) return [];
  const seps = [" vs ", " vs. ", " @ ", " at "];
  let parts = [t];
  for (const s of seps) {
    if (t.toLowerCase().includes(s.trim())) {
      parts = t.split(new RegExp(s, "i"));
      break;
    }
  }
  return parts.map(p => p.trim()).filter(Boolean);
}

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

  const [alerts, setAlerts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(VIEWS[0]);

  // Search + watchlists
  const [query, setQuery] = useState("");
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);

  const [watchlistMarkets, setWatchlistMarkets] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("bubldex_watch_markets") || "[]")); } catch { return new Set(); }
  });
  const [watchlistTeams, setWatchlistTeams] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("bubldex_watch_teams") || "[]")); } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem("bubldex_watch_markets", JSON.stringify(Array.from(watchlistMarkets)));
  }, [watchlistMarkets]);
  useEffect(() => {
    localStorage.setItem("bubldex_watch_teams", JSON.stringify(Array.from(watchlistTeams)));
  }, [watchlistTeams]);

  function toggleWatchMarket(id) {
    if (!id) return;
    setWatchlistMarkets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleWatchTeam(name) {
    const key = String(name || "").toLowerCase().trim();
    if (!key) return;
    setWatchlistTeams(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function load() {
    setBusy(true); setError(null);
    try {
      const baseParams = { hours: FIXED_HOURS, minUsd: 100, takerOnly: true };
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
          source: String(m.source || inferSource(m)).toLowerCase(),
        };
      });

      setMarkets(list);
      setBusy(false);
    } catch (err) {
      setError(String(err?.message || err));
      setBusy(false);
    }
  }
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [sources]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedId) { setSelectedMarket(null); setSelectedDetail(null); return; }
      const m = markets.find(x => x.conditionId === selectedId);
      setSelectedMarket(m || null);
      try {
        const d = await fetchMarketDetail(selectedId, { hours: FIXED_HOURS });
        if (!cancelled) setSelectedDetail(d || null);
      } catch { if (!cancelled) setSelectedDetail(null); }
    })();
    return () => { cancelled = true; };
  }, [selectedId, markets]);

  // --- Alert logic ---
  const [lastAlertAt, setLastAlertAt] = useState({}); // id -> epoch sec
  useEffect(() => {
    let stop = false;
    async function checkAlerts() {
      // Build candidate ids from explicit market watchlist + titles containing watched teams
      const teamTokens = Array.from(watchlistTeams);
      const teamMatches = markets
        .filter(m => teamTokens.some(tok => String(m.title || "").toLowerCase().includes(tok)))
        .map(m => m.conditionId);

      const ids = Array.from(new Set([
        ...Array.from(watchlistMarkets),
        ...teamMatches
      ])).slice(0, 15);

      if (!ids.length) return;

      for (const id of ids) {
        if (stop) break;
        try {
          const d = await fetchMarketDetail(id, { hours: FIXED_HOURS });
          const trades = d?.trades || d?.market?.trades || [];
          const bins = minuteBins1h(trades);
          const { z, last5, mean } = zscore5v30(bins);
          const now = Math.round(Date.now()/1000);
          const cooldown = 7 * 60; // 7 minutes
          const recent = lastAlertAt[id] && (now - lastAlertAt[id] < cooldown);
          if (!recent && z >= 2.5 && last5 >= 500) {
            const m = markets.find(x => x.conditionId === id) || { title: id };
            const title = `Flow spike ↑: ${m.title}`;
            const body = `5m $${Math.round(last5).toLocaleString()} vs 30m avg $${Math.round(mean).toLocaleString()} (z=${z.toFixed(2)})`;
            const key = `${id}:${now}`;
            setAlerts(a => [...a, { id: key, title, body }]);
            setLastAlertAt(prev => ({ ...prev, [id]: now }));
          }
        } catch {}
      }
    }
    const t = setInterval(checkAlerts, 20000);
    checkAlerts();
    return () => { stop = true; clearInterval(t); };
  }, [watchlistMarkets, watchlistTeams, markets, lastAlertAt]);

  const filtered = useMemo(() => {
    let arr = Array.isArray(markets) ? markets : [];
    if (onlyWatchlist) {
      const teamTokens = Array.from(watchlistTeams);
      arr = arr.filter(m => watchlistMarkets.has(m.conditionId) || teamTokens.some(tok => String(m.title || "").toLowerCase().includes(tok)));
    }
    const ht = (query || "").toLowerCase();
    if (ht) arr = arr.filter(m => String(m.title || "").toLowerCase().includes(ht));
    return arr;
  }, [markets, watchlistMarkets, watchlistTeams, onlyWatchlist, query]);

  const watchCount = watchlistMarkets.size + watchlistTeams.size;

  return (
    <div className="app-shell">
      {error && (
        <div style={{background:"#3b1f1f",border:"1px solid #6b2f2f",color:"#f2c6c6",padding:10,borderRadius:8,marginBottom:12}}>
          {String(error)}
        </div>
      )}

      <div className="h1">BublDex — Sports Insight</div>

      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
        <SourceToggle selected={sources} onChange={setSources} />
        <div style={{ marginLeft: "auto", display:"flex", gap:12, alignItems:"center" }}>
          <label style={{ display:"inline-flex", alignItems:"center", gap:8, color:"#c6cfdb" }}>
            <input type="checkbox" checked={onlyWatchlist} onChange={e => setOnlyWatchlist(e.target.checked)} />
            Watchlist only
          </label>
          <span style={{ color:"#9fb0c7", fontSize:12 }}>Watch: <strong>{watchCount}</strong></span>
          <span style={{ color:"#9fb0c7", fontSize:12 }}>Window: <strong>1h</strong></span>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
        <input
          placeholder="Search markets…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ background:"#0b1520", color:"#e6edf5", border:"1px solid #2b3c52", borderRadius:10, padding:"8px 12px" }}
        />
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

      {view === "Board" && (
        <BubbleBoard
          markets={filtered}
          onSelect={({ conditionId }) => setSelectedId(conditionId)}
        />
      )}

      {view === "Heatmap" && (
        <BubbleHeatmap
          markets={filtered}
          onSelect={({ conditionId }) => setSelectedId(conditionId)}
        />
      )}

      {view === "List" && (
        <MarketList
          markets={filtered}
          onRowClick={(m) => setSelectedId(m.conditionId)}
        />
      )}

      {selectedMarket && (
        <DetailsModal
          market={selectedMarket}
          detail={selectedDetail}
          watchlistMarkets={watchlistMarkets}
          watchlistTeams={watchlistTeams}
          onToggleWatchMarket={toggleWatchMarket}
          onToggleWatchTeam={toggleWatchTeam}
          extractTeamsFromTitle={extractTeamsFromTitle}
          onClose={() => setSelectedId(null)}
        />
      )}

      <Toaster
        alerts={alerts}
        onDismiss={(id) => setAlerts(a => a.filter(x => x.id !== id))}
      />
      <DebugPanel open={false} logs={[]} onClear={() => {}} />
    </div>
  );
}
