// src/lib/api.js

/* ------------ small utils ------------ */
const shortAddr = (w) =>
  (w && w.length > 12) ? `${w.slice(0,6)}…${w.slice(-4)}` : (w || '');

function normalizeFeedBase(raw) {
  let b = (raw || "/feed").trim().replace(/\/+$/, "");
  if (!b || b === "/") return "/feed";
  if (/^https?:\/\//i.test(b)) return b.endsWith("/feed") ? b : b + "/feed";
  return b; // relative like "/feed"
}

/** Robust prod fallback: if env missing on Firebase Hosting, use your Cloud Run URL */
function resolveFeedBase() {
  const envBase = (import.meta?.env && import.meta.env.VITE_FEED_BASE) || "";
  const qpBase = new URLSearchParams(location.search).get("feed") || "";
  const metaBase =
    document.querySelector('meta[name="feed-base"]')?.getAttribute("content") ||
    "";

  const onFirebase =
    /\.web\.app$/.test(location.hostname) ||
    /\.firebaseapp\.com$/.test(location.hostname);

  // Absolute daemon — set VITE_FEED_BASE in .env.production to your Cloud Run URL
  const ABSOLUTE_DAEMON = "";

  // Priority: query param > env > meta > fallback
  let base = qpBase || envBase || metaBase || (onFirebase ? ABSOLUTE_DAEMON : "/feed");

  const FEED = normalizeFeedBase(base);

  try {
    console.info("[Redmen] FEED base:", FEED, {
      from: qpBase
        ? "query"
        : envBase
        ? "env"
        : metaBase
        ? "meta"
        : onFirebase
        ? "firebase-fallback"
        : "dev-default",
    });
  } catch {}

  return FEED;
}

export const FEED = resolveFeedBase();
export const endpoints = { FEED };

/* ------------ HTTP helper ------------ */
async function getJson(url, opts = {}) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} @ ${url}`);
    err.status = res.status;
    err.url = url;
    try { err.body = await res.text(); } catch {}
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const txt = await res.text();
    throw new Error(`Expected JSON, got HTML from ${url}. First bytes: ${txt.slice(0, 80)}`);
  }
  return res.json();
}

/* ------------ API calls ------------ */
export async function fetchMarkets(params = {}) {
  const qs = new URLSearchParams({
    hours: String(params.hours ?? 24),
    minUsd: String(params.minUsd ?? 100),
    takerOnly: String(params.takerOnly ?? true),
    limit: String(params.limit ?? 1000),
    offset: String(params.offset ?? 0),
  });
  if (params.source) { qs.set('source', String(params.source)); }
return getJson(`${FEED}/markets?${qs.toString()}`);
}

export async function fetchMarket(id, params = {}) {
  const qs = new URLSearchParams({
    hours: String(params.hours ?? 24),
    takerOnly: String(params.takerOnly ?? true),
  });
  const data = await getJson(`${FEED}/market/${encodeURIComponent(id)}?${qs.toString()}`);

  // ---- Name-first mapping for UI: ensure every trade + bettor has a friendly label
  if (data && data.market) {
    if (Array.isArray(data.market.trades)) {
      data.market.trades = data.market.trades.map(t => ({
        ...t,
        display: t.display || "",                 // from daemon
        wallet: t.wallet || "",
        label: (t.display && t.display.trim())   // prefer name/pseudonym
          ? t.display.trim()
          : shortAddr(t.wallet),                  // fallback to short wallet
      }));
    }
    if (Array.isArray(data.market.topBettors)) {
      data.market.topBettors = data.market.topBettors.map(b => ({
        ...b,
        display: b.display || "",
        wallet: b.wallet || "",
        label: (b.display && b.display.trim())
          ? b.display.trim()
          : shortAddr(b.wallet),
      }));
    }
  }
  return data;
}

/* ------------ Helpers (kept) ------------ */
export function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function computeSplit(market) {
  if (!market) return { aPct: 50, bPct: 50, mode: "empty" };
  if (market.outcomes && typeof market.outcomes === "object") {
    const vals = Object.values(market.outcomes);
    if (vals.length >= 2) {
      const top = vals.sort((a, b) => (b.usd || 0) - (a.usd || 0)).slice(0, 2);
      const a = num(top[0].usd), b = num(top[1].usd), tot = a + b;
      if (tot > 0) return { aPct: (a / tot) * 100, bPct: (b / tot) * 100, mode: "outcomes" };
    }
  }
  const buy = num(market?.buys ?? market?.totals?.buyUSD);
  const sell = num(market?.sells ?? market?.totals?.sellUSD);
  const tot = buy + sell;
  if (tot > 0) return { aPct: (buy / tot) * 100, bPct: (sell / tot) * 100, mode: "flow" };
  return { aPct: 50, bPct: 50, mode: "empty" };
}

export function fmtPct(p) {
  if (p > 0 && p < 0.1) return "<0.1%";
  if (p > 99.9 && p < 100) return ">99.9%";
  return `${p.toFixed(1)}%`;
}

/* -------- Compatibility aliases (keep old imports working) -------- */
export async function fetchMarketDetail(id, params = {}) {
  return fetchMarket(id, params);
}
export async function fetchSportsEvents(params = {}) {
  return fetchMarkets(params);
}
