import React, { useEffect, useMemo, useState } from "react";
import {
  fetchSportsEvents,
  fetchTrades,
  fetchPriceHistory,
  fetchAllClobMarkets,
  endpoints,
} from "./lib/api.js";
import DebugPanel from "./components/DebugPanel.jsx";
import MarketCard from "./components/MarketCard.jsx";
import BubbleBoard from "./components/BubbleBoard.jsx";
// keep this import
import DetailsModal from "./components/DetailsModal.jsx";

function usd(n) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function App() {
  // UI state
  const [trades, setTrades] = useState([]);
  const [minCash, setMinCash] = useState(100);
  const [hours, setHours] = useState(24);
  const [sideFilter, setSideFilter] = useState("all"); // all|BUY|SELL
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [selected, setSelected] = useState(null); // market slug key
  const [showInfo, setShowInfo] = useState(false);
  const [view, setView] = useState("bubbles"); // "bubbles" | "list"

  // debug logger
  function log(entry) {
    setLogs((prev) => [{ ...entry, when: new Date().toISOString() }, ...prev].slice(0, 60));
  }
  function logError(label, e) {
    const msg = e?.message || String(e);
    setError(msg);
    log({ label, error: msg });
  }

  // main loader
  async function load() {
    setBusy(true);
    setError(null);
    try {
      // 1) Events (debug only)
      const ev = await fetchSportsEvents();
      log({
        label: "Fetched sports events",
        url: ev.url,
        data: { count: Array.isArray(ev.data) ? ev.data.length : 0 },
      });

      // 2) All CLOB markets → index by condition_id
      const mkDataAll = await fetchAllClobMarkets();

      // Build a fast lookup by conditionId
      const byCondition = new Map();
      for (const m of mkDataAll) {
        const cid = m.condition_id != null ? String(m.condition_id) : null;
        if (!cid) continue;
        byCondition.set(cid, m);
      }

      // Helper: strict sports check
      function isSportsMarket(meta, text = "") {
        const lc = (s) => String(s || "").toLowerCase();
        const hayParts = [
          meta?.category, meta?.subcategory, meta?.vertical, meta?.group,
          meta?.topic, ...(Array.isArray(meta?.topics) ? meta.topics : []),
          ...(Array.isArray(meta?.categories) ? meta.categories : []),
          ...(Array.isArray(meta?.tags) ? meta.tags : []), text
        ].filter(Boolean).map(lc);

        const hay = hayParts.join(" ");

        // hard excludes (geopolitics/news/etc.)
        const exclude = [
          "ukraine","russia","donbass","election","vote","parliament","nato","ceasefire",
          "referendum","cabinet","minister","war","strike","coup","inflation","fed",
          "crypto","bitcoin","ethereum","btc","eth"
        ];
        if (exclude.some((w) => hay.includes(w))) return false;

        // vertical signal takes priority when provided
        if (lc(meta?.vertical) === "sports") return true;

        // league/root whitelist
        const leagues = [
          "mlb","baseball","nba","basketball","nfl","football","nhl","hockey","soccer","mls",
          "epl","premier league","la liga","serie a","bundesliga","ncaaf","ncaab","ncaa",
          "college","tennis","golf","mma","ufc","boxing","olympics","f1","formula 1",
          "motogp","cricket","rugby"
        ];
        const roots = ["sport","sports"];
        const hasLeague = leagues.some((w) => hay.includes(w)) || roots.some((w) => hay.includes(w));

        // title/slug patterns that look like sports
        const likelySportsPattern =
          /\bvs\.?\b|\bwin\b|\bmatch\b|\bgame\b|\bseries\b|\bfinal\b|\bround\b/i.test(text);

        return hasLeague || likelySportsPattern;
      }

      log({
        label: "Fetched markets & built index",
        url: "/api/clob/markets (all pages)",
        data: { markets: mkDataAll.length, indexed: byCondition.size },
      });

      // 3) Fetch trades (two pages)
      const t1 = await fetchTrades({ minCash, limit: 500, offset: 0 });
      const t2 = await fetchTrades({ minCash, limit: 500, offset: 500 });
      let all = [...t1.data, ...t2.data];
      log({ label: "Fetched trades page1", url: t1.url, data: { count: t1.data.length } });
      log({ label: "Fetched trades page2", url: t2.url, data: { count: t2.data.length } });

      const since = Math.floor(Date.now() / 1000) - hours * 3600;

      // 4) Sports-only filter (strict; no non-sports fallback)
      const filtered = all.filter((t) => {
        if (t.timestamp < since) return false;
        if (sideFilter !== "all" && t.side !== sideFilter) return false;

        const cid = String(t.conditionId || "");
        const meta = byCondition.get(cid);
        const text = `${t.title} ${t.slug} ${t.category || ""} ${t.eventSlug || ""}`;
        return isSportsMarket(meta, text);
      });

      // 5) Optional search filter (applied after sports-only)
      const q = search.trim().toLowerCase();
      const searched = q
        ? filtered.filter((t) => (`${t.title} ${t.slug} ${t.eventSlug || ""}`).toLowerCase().includes(q))
        : filtered;

      setTrades(searched);
      log({
        label: "Filtered sports trades (strict)",
        data: { count: searched.length, since }
      });
    } catch (e) {
      console.error(e);
      logError("ERROR load", e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ----- Aggregations (crash‑proof) -----
  const byMarket = useMemo(() => {
    try {
      const map = new Map();

      for (const t of Array.isArray(trades) ? trades : []) {
        // defensive reads
        const key =
          (t && (t.slug || t.title || String(t.conditionId ?? ""))) || "unknown";
        const title = (t && t.title) || key || "Unknown market";
        const eventSlug = (t && t.eventSlug) || "";

        const entry =
          map.get(key) || {
            slug: key,
            title,
            eventSlug,
            totalUSD: 0,
            buys: 0,
            sells: 0,
            lastTs: 0,
            outcomes: {},      // { [label]: { usd, count } }
            tradeCount: 0,
            tokenIds: new Set(),
            trades: [],        // compact per‑market trades for details
          };

        const size = Number(t?.size) || 0;
        if ((t?.side) === "BUY") entry.buys += size;
        else if ((t?.side) === "SELL") entry.sells += size;
        entry.totalUSD += size;
        entry.tradeCount += 1;
        entry.lastTs = Math.max(entry.lastTs, Number(t?.timestamp) || 0);

        const outcomeLabel =
          (t?.outcome) || `Outcome ${t?.outcomeIndex ?? "?"}`;
        if (!entry.outcomes[outcomeLabel])
          entry.outcomes[outcomeLabel] = { usd: 0, count: 0 };
        entry.outcomes[outcomeLabel].usd += size;
        entry.outcomes[outcomeLabel].count += 1;

        if (t?.asset) entry.tokenIds.add(t.asset);

        entry.trades.push({
          side: t?.side || "BUY",
          size,
          timestamp: Number(t?.timestamp) || 0,
          name: t?.name || t?.pseudonym || t?.proxyWallet || "Anon",
          outcome: outcomeLabel,
        });

        map.set(key, entry);
      }

      const arr = Array.from(map.values()).map((v) => {
        const tokenIds = Array.from(v.tokenIds);
        const bettorMap = new Map();

        for (const tr of v.trades || []) {
          const id = tr?.name || "Anon";
          const e = bettorMap.get(id) || { id, buys: 0, sells: 0, trades: 0 };
          if (tr?.side === "BUY") e.buys += Number(tr?.size) || 0;
          else e.sells += Number(tr?.size) || 0;
          e.trades += 1;
          bettorMap.set(id, e);
        }

        const topBettors = Array.from(bettorMap.values())
          .sort(
            (a, b) =>
              (Number(b.buys) + Number(b.sells)) -
              (Number(a.buys) + Number(a.sells))
          )
          .slice(0, 10);

        return { ...v, tokenIds, topBettors };
      });

      arr.sort(
        (a, b) => (Number(b.totalUSD) || 0) - (Number(a.totalUSD) || 0)
      );
      return arr.slice(0, 50);
    } catch (e) {
      // Don’t crash the app; surface the error and return an empty list
      console.error("byMarket memo failed:", e);
      return [];
    }
  }, [trades]);

  // Global Top Bettors (defensive)
  const topBettors = useMemo(() => {
    const m = new Map();
    for (const t of Array.isArray(trades) ? trades : []) {
      const id = t?.name || t?.pseudonym || t?.proxyWallet || "Anon";
      const entry = m.get(id) || { id, buys: 0, sells: 0, count: 0 };
      const size = Number(t?.size) || 0;
      if (t?.side === "BUY") entry.buys += size;
      else if (t?.side === "SELL") entry.sells += size;
      entry.count += 1;
      m.set(id, entry);
    }
    const arr = Array.from(m.values());
    arr.sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells));
    return arr.slice(0, 25);
  }, [trades]);

  // Selected market (safe)
  const selectedMarket = useMemo(() => {
    if (!selected) return null;
    return (byMarket || []).find((m) => m.slug === selected) || null;
  }, [selected, byMarket]);

  // Lazy fetch price for selected market
  const [priceInfo, setPriceInfo] = useState(null);
  useEffect(() => {
    async function loadPrice() {
      if (!selectedMarket || !selectedMarket.tokenIds?.length) {
        setPriceInfo(null);
        return;
      }
      try {
        const token = selectedMarket.tokenIds[0];
        const resp = await fetchPriceHistory({ tokenId: token, interval: "1d" });
        const hist = resp.data?.history || [];
        setPriceInfo({
          token, url: resp.url,
          last: hist.at(-1)?.p ?? null,
          first: hist[0]?.p ?? null,
        });
      } catch (e) {
        setPriceInfo({ error: e?.message });
      }
    }
    loadPrice();
  }, [selectedMarket]);

  // ----- RENDER -----
  return (
    <div className="container">
      <div className="header">
        <h1>Redmen MVP</h1>
        <span className="badge">Live public APIs</span>
        <span className="badge">Sports only</span>
        <span className="badge">≥ ${minCash}</span>

        <button className="primary" onClick={() => setShowInfo(true)} aria-haspopup="dialog">Info</button>
        <button className="primary" onClick={() => setShowDebug((s) => !s)}>
          {showDebug ? "Hide" : "Show"} Debug
        </button>
        <button className="primary" onClick={() => setView(view === "bubbles" ? "list" : "bubbles")}>
          {view === "bubbles" ? "List View" : "Bubble View"}
        </button>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div>
            <div className="label">Min USD per trade</div>
            <input type="number" value={minCash} onChange={(e) => setMinCash(Number(e.target.value))} min="0" />
          </div>
          <div>
            <div className="label">Lookback (hours)</div>
            <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} min="1" />
          </div>
          <div>
            <div className="label">Side</div>
            <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="BUY">Buys</option>
              <option value="SELL">Sells</option>
            </select>
          </div>
          <div>
            <div className="label">Search (title/event)</div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Orioles, Red Sox..." />
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button disabled={busy} className="primary" onClick={load}>
              {busy ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div style={{ color: "var(--bad)", marginBottom: 8 }}>Error: {error}</div>}

        {view === "bubbles" ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <b>Bubble Dashboard</b>
            {/* IMPORTANT: wrapper ensures we pass a slug even if bubble sends an object */}
            <BubbleBoard
              markets={Array.isArray(byMarket) ? byMarket : []}
              onSelect={(m) => setSelected(m?.slug ?? m)}
            />
          </div>
        ) : (
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>Top Markets by Flow</b>
              <span className="small">Click a market for details</span>
            </div>
            <div className="list" style={{ marginTop: 8 }}>
              {byMarket.map((m) => (
                <MarketCard key={m.slug} mkt={m} onClick={() => setSelected(m.slug)} />
              ))}
              {byMarket.length === 0 && <div className="small">No trades found for your filters.</div>}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <b>Top Bettors (by $ flow)</b>
        <div className="list" style={{ marginTop: 8 }}>
          {topBettors.map((u) => {
            const total = (u.buys || 0) + (u.sells || 0);
            const bias = total > 0 ? ((u.buys || 0) - (u.sells || 0)) / total : 0;
            return (
              <div className="item" key={u.id}>
                <div>
                  <div className="market-title">{u.id}</div>
                  <div className="chips" style={{ marginTop: 6 }}>
                    <span className="badge">${total.toFixed(0)} total</span>
                    <span className="badge">Trades: {u.count || 0}</span>
                  </div>
                </div>
                <div className="right small" style={{ color: bias >= 0 ? "var(--good)" : "var(--bad)" }}>
                  {(bias * 100).toFixed(1)}% net buy bias
                </div>
              </div>
            );
          })}
          {topBettors.length === 0 && <div className="small">No bettor activity in this window.</div>}
        </div>

        <div className="hr" />
        <div className="footer">
          <div>
            APIs used:
            <a href={endpoints.GAMMA + "/events"} target="_blank" rel="noreferrer"> Gamma /events</a> •
            <a href={endpoints.DATA + "/trades"} target="_blank" rel="noreferrer"> Data /trades</a> •
            <a href={endpoints.CLOB + "/prices-history"} target="_blank" rel="noreferrer"> CLOB /prices-history</a>
          </div>
        </div>
      </div>

      {/* MODAL: replaces the old inline panel */}
      {selectedMarket && (
        <DetailsModal
          market={selectedMarket}
          priceInfo={priceInfo}
          onClose={() => setSelected(null)}
        />
      )}

      <DebugPanel open={showDebug} logs={logs} onClear={() => setLogs([])} />
    </div>
  );
}
