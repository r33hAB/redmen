// src/lib/api.js
function normalizeFeedBase(raw) {
  const b = (raw || "/feed").replace(/\/+$/, "");
  if (!b || b === "/") return "/feed";
  if (/^https?:\/\//i.test(b)) return b.endsWith("/feed") ? b : b + "/feed";
  return b;
}
export const FEED = normalizeFeedBase(import.meta?.env?.VITE_FEED_BASE);
export const endpoints = { FEED };

async function getJson(url, opts = {}) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} @ ${url}`);
    err.status = res.status;
    err.url = url;
    try { err.body = await res.text(); } catch {}
    throw err;
  }
  return res.json();
}
const num = (x) => (x == null ? 0 : +x || 0);

export async function fetchHealth() { return getJson(`${FEED}/health`); }

export async function fetchSportsEvents(params = {}) {
  const { hours = 6, minUsd = 100, takerOnly = true, side, limit = 1000, offset = 0 } = params;
  const q = new URLSearchParams({
    hours: String(hours), minUsd: String(minUsd), takerOnly: String(takerOnly),
    limit: String(limit), offset: String(offset),
  });
  if (side) q.set("side", side);
  const json = await getJson(`${FEED}/markets?${q.toString()}`);
  const rows = Array.isArray(json?.markets) ? json.markets : Array.isArray(json) ? json : [];
  return rows.map((m) => ({
    conditionId: m.conditionId ?? m.slug ?? m.title ?? null,
    slug: m.slug || "", title: m.title || "",
    totalUSD: num(m.totalUSD ?? m.totals?.totalUSD),
    buys: num(m.buys ?? m.totals?.buyUSD),
    sells: num(m.sells ?? m.totals?.sellUSD),
    uniqueBuyers: num(m.uniqueBuyers ?? m.totals?.uniqueBuyers),
    uniqueSellers: num(m.uniqueSellers ?? m.totals?.uniqueSellers),
    activityScore: num(m.activityScore),
    trades: num(m.trades ?? m.totals?.trades),
    outcomes: Array.isArray(m.outcomes || m.outcomeTotals)
      ? (m.outcomes || m.outcomeTotals).map((o) => ({
          label: o.label ?? o.name ?? "",
          usd:   num(o.usd ?? o.totalUSD ?? o.flowUSD),
          trades:num(o.trades),
        }))
      : undefined,
  }));
}

export async function fetchMarketDetail(conditionId, params = {}) {
  const { hours = 24 } = params;
  return getJson(`${FEED}/market/${encodeURIComponent(conditionId)}?hours=${hours}`);
}
export async function fetchTrades(conditionId, params = {}) {
  const { hours = 24 } = params;
  const json = await getJson(`${FEED}/market/${encodeURIComponent(conditionId)}?hours=${hours}`);
  return Array.isArray(json?.market?.trades) ? json.market.trades : [];
}
export async function fetchPriceHistory(conditionId, params = {}) {
  const { hours = 24 } = params;
  const json = await getJson(`${FEED}/market/${encodeURIComponent(conditionId)}?hours=${hours}`);
  return Array.isArray(json?.market?.price24h) ? json.market.price24h : [];
}
export async function fetchAllClobMarkets(params = {}) {
  const markets = await fetchSportsEvents(params);
  return markets.map((m) => ({ condition_id: m.conditionId, slug: m.slug, title: m.title }));
}
export function ringSplit(market) {
  const outs = Array.isArray(market?.outcomes) ? market.outcomes.filter(o => (o.usd || 0) > 0) : [];
  if (outs.length >= 2) {
    const top = [...outs].sort((a, b) => (b.usd || 0) - (a.usd || 0)).slice(0, 2);
    const a = num(top[0].usd), b = num(top[1].usd), tot = a + b;
    if (tot > 0) return { aPct: (a / tot) * 100, bPct: (b / tot) * 100, mode: "outcomes" };
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
