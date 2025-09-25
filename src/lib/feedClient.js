/**
 * Lightweight client for the Cloud Run daemon feed.
 * Reads base from VITE_FEED_BASE or defaults to production URL.
 */
const FEED_BASE =
  import.meta?.env?.VITE_FEED_BASE ||
  "REDACTED_CLOUD_RUN_URL";

/**
 * Fetch sports markets with parameters.
 * opts: { hours=24, minUsd=100, takerOnly=true, limit=1000, offset=0, signal }
 * Returns: { markets: [...] } or [] on failure
 */
export async function fetchMarketsFeed(opts = {}) {
  const {
    hours = 24,
    minUsd = 100,
    takerOnly = true,
    limit = 1000,
    offset = 0,
    signal,
  } = opts;

  const url = new URL(`${FEED_BASE}/markets`);
  url.searchParams.set("hours", String(hours));
  url.searchParams.set("minUsd", String(minUsd));
  url.searchParams.set("takerOnly", String(takerOnly));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Feed ${res.status}`);
  const data = await res.json();
  // Expect either array or { markets: [] }
  return Array.isArray(data) ? data : (data?.markets || []);
}