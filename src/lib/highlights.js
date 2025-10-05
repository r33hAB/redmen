
// src/lib/highlights.js
function normalizeFeedBase(raw) {
  let b = (raw || "/feed").trim().replace(/\/+$/, "");
  if (!b || b === "/") return "/feed";
  if (/^https?:\/\//i.test(b)) return b.endsWith("/feed") ? b : b + "/feed";
  return b;
}
function resolveFeedBase() {
  const envBase = (import.meta?.env && import.meta.env.VITE_FEED_BASE) || "";
  if (envBase && /^https?:/i.test(envBase)) return envBase.endsWith("/feed")?envBase:envBase+"/feed";
  if (envBase && envBase.startsWith("/")) return envBase;
  const { origin } = window.location;
  const defaultBase = origin.includes("localhost") ? "http://localhost:8080/feed" : "/feed";
  return normalizeFeedBase(envBase || defaultBase);
}
export function resolveHighlightsBase() {
  const url = (import.meta?.env && import.meta.env.VITE_HIGHLIGHTS_URL) || "";
  if (url) return url.replace(/\/?$/, "");
  return resolveFeedBase() + "/highlights";
}
export async function fetchHighlights(params = {}) {
  const base = resolveHighlightsBase();
  const url = new URL(base, window.location.origin);
  Object.entries(params || {}).forEach(([k,v]) => {
    if (v!=null && v!=="") url.searchParams.set(k, String(v));
  });
  const r = await fetch(url.toString(), { headers: { "Accept":"application/json" }});
  if (!r.ok) throw new Error(`Highlights HTTP ${r.status}`);
  return r.json();
}
