// ---- Polymarket API client (dev-proxy friendly) ----
// In dev, Vite proxies these to avoid CORS:
//   /api/gamma -> https://gamma-api.polymarket.com
//   /api/data  -> https://data-api.polymarket.com
//   /api/clob  -> https://clob.polymarket.com

const GAMMA = "/api/gamma";
const DATA  = "/api/data";
const CLOB  = "/api/clob";

export const endpoints = { GAMMA, DATA, CLOB };

async function getJson(url, opts = {}) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  if (!res.ok) {
    const msg = `HTTP ${res.status} @ ${url}`;
    const err = new Error(msg);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return res.json();
}

// Robust sports events fetch (used for debug/telemetry only)
export async function fetchSportsEvents({ limit = 200 } = {}) {
  const urls = [
    `${GAMMA}/events?active=true&tag_slug=sports&limit=${limit}`,
    `${GAMMA}/events?active=true&tag=sports&limit=${limit}`,
    `${GAMMA}/events?active=true&limit=${limit}`,
    `${GAMMA}/events?limit=${limit}`,
  ];
  let lastErr = null;
  for (const url of urls) {
    try {
      const data = await getJson(url);
      const filtered =
        url.includes("tag=") || url.includes("tag_slug=")
          ? data
          : (Array.isArray(data)
              ? data.filter(
                  (e) =>
                    (e.tags || [])
                      .map(String)
                      .some((t) => t.toLowerCase().includes("sport"))
                )
              : data);
      return { url, data: filtered };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Failed to fetch events");
}

// Recent trades (site-wide)
export async function fetchTrades({
  minCash = 100,
  limit = 500,
  offset = 0,
  takerOnly = true,
} = {}) {
  const url = `${DATA}/trades?limit=${limit}&offset=${offset}&takerOnly=${String(
    takerOnly
  )}&filterType=CASH&filterAmount=${minCash}`;
  const data = await getJson(url);
  return { url, data };
}

// Price history (simple)
export async function fetchPriceHistory({ tokenId, interval = "1d" }) {
  const url = `${CLOB}/prices-history?market=${encodeURIComponent(
    tokenId
  )}&interval=${interval}`;
  const data = await getJson(url);
  return { url, data };
}

// Fetch ALL CLOB markets (paginate using next_cursor)
export async function fetchAllClobMarkets() {
  let next = "";
  const all = [];
  for (let i = 0; i < 20; i++) {
    const url = `${CLOB}/markets${next ? `?next_cursor=${encodeURIComponent(next)}` : ""}`;
    const json = await getJson(url);
    const data = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    all.push(...data);
    next = json?.next_cursor || "";
    if (!next) break;
  }
  return all;
}
