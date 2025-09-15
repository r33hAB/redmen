// ---- Redmen FEED client (daemon-backed) ----
// The app consumes local daemon endpoints via Vite proxy: /feed -> http://localhost:7777

const FEED = "/feed";
export const endpoints = { FEED };

async function getJson(url, opts = {}) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  if (!res.ok) {
    const msg = `HTTP ${res.status} @ ${url}`;
    const err = new Error(msg);
    err.status = res.status;
    err.url = url;
    try { err.body = await res.text(); } catch {}
    throw err;
  }
  return res.json();
}

// Summary list for Bubble Board / Heatmap / List
export async function fetchSportsEvents(params = {}) {
  const { hours = 6, minUsd = 100, takerOnly = true, side, limit = 1000, offset = 0 } = params;
  const q = new URLSearchParams({ hours, minUsd, takerOnly, limit, offset });
  if (side) q.set("side", side);
  const json = await getJson(`${FEED}/markets?${q.toString()}`);
  const rows = Array.isArray(json?.markets) ? json.markets : Array.isArray(json) ? json : [];
  // map to common shape
  return rows.map(m => ({
    conditionId: m.conditionId ?? m.slug ?? m.title ?? null,
    slug: m.slug || "",
    title: m.title || "",
    totalUSD: m.totalUSD ?? m.totals?.totalUSD ?? 0,
    buys: m.buys ?? m.totals?.buyUSD ?? 0,
    sells: m.sells ?? m.totals?.sellUSD ?? 0,
    uniqueBuyers: m.uniqueBuyers ?? m.totals?.uniqueBuyers ?? 0,
    uniqueSellers: m.uniqueSellers ?? m.totals?.uniqueSellers ?? 0,
    activityScore: m.activityScore ?? 0,
    trades: m.trades ?? m.totals?.trades ?? 0,
  }));
}

// Trades-only (legacy compatibility)
export async function fetchTrades(conditionId, params = {}) {
  const { hours = 24 } = params;
  const json = await getJson(`${FEED}/market/${encodeURIComponent(conditionId)}?hours=${hours}`);
  return Array.isArray(json?.market?.trades) ? json.market.trades : [];
}

// Optional 24h price snapshot (legacy compatibility)
export async function fetchPriceHistory(conditionId, params = {}) {
  const { hours = 24 } = params;
  const json = await getJson(`${FEED}/market/${encodeURIComponent(conditionId)}?hours=${hours}`);
  return Array.isArray(json?.market?.price24h) ? json.market.price24h : [];
}

// Full detail (topBettors, outcomes, totals, price24h)
export async function fetchMarketDetail(conditionId, params = {}) {
  const { hours = 24 } = params;
  return getJson(`${FEED}/market/${encodeURIComponent(conditionId)}?hours=${hours}`);
}

// Compatibility shim for components still calling this
export async function fetchAllClobMarkets(params = {}) {
  const markets = await fetchSportsEvents(params);
  return markets.map(m => ({
    condition_id: m.conditionId,
    slug: m.slug,
    title: m.title
  }));
}
