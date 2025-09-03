/**
 * auto-highlights.mjs
 *
 * Sports-only Polymarket highlights detector for Redmen.
 * - Sports filter = Gamma active sports events (condition_ids)
 *                   + CLOB map (conditionId -> clob id/hash)
 *                   + Title/league regex fallback
 *                   + Lazy per-id market resolver for misses (matches UI)
 * - Fetches trades window with minUsd/hours/takerOnly (paginated)
 * - Detects Whale Single, Whale Run, Rapid Fire, Market Surge
 * - Enriches titles/league; writes GPT or “wow-mode” headlines
 *
 * Run (PowerShell example):
 *   $env:OPENAI_API_KEY="sk-..."   # optional for GPT lines
 *   node auto-highlights.mjs --window=12h --minUsd=100 --takerOnly=0 --baseUrl=http://localhost:5173 --maxPages=200 --model=gpt-4.1-mini
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------------- CLI / Config ----------------
const args = Object.fromEntries(process.argv.slice(2).map(s => {
  const [k, v] = s.replace(/^--/, "").split("=");
  return [k, v ?? "1"];
}));
const WINDOW_H       = Number(args.window || args.hours || 6);
const MIN_USD        = Number(args.minUsd || 100);
const TAKER_ONLY     = Number(args.takerOnly ?? 1) ? 1 : 0;
const MAX_PAGES      = Number(args.maxPages || 200);
const BASE_URL       = args.baseUrl || ""; // leave empty to use relative /api/... via Vite proxy
const MODEL          = args.model || "gpt-4.1-mini";

// Highlight thresholds (tweakable)
const WHALE_SINGLE     = Number(args.whaleSingle || 10_000);
const WHALE_RUN_TOTAL  = Number(args.whaleRunTotal || 50_000);
const WHALE_RUN_TRADES = Number(args.whaleRunTrades || 5);
const RAPID_COUNT      = Number(args.rapidCount || 5);
const RAPID_WINDOW_MIN = Number(args.rapidWindowMin || 10);
const MAX_TOTAL        = Number(args.maxTotal || 12);

const DATA  = (p) => `${BASE_URL}/api/data${p}`;
const GAMMA = (p) => `${BASE_URL}/api/gamma${p}`;
const CLOB  = (p) => `${BASE_URL}/api/clob${p}`;

const OUT_JSON = path.resolve("./highlights.latest.json");
const OUT_MD   = path.resolve("./highlights.latest.md");

// league keyword fallback (mirrors app intent)
const LEAGUE_RX = /\b(nba|nfl|mlb|nhl|ufc|mma|soccer|epl|laliga|serie\s*a|bundesliga|mls|ncaab|ncaaf|tennis|atp|wta|golf|pga|f1|motogp|boxing)\b/i;

// ---------------- Utils ----------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function log(...a) { console.log(new Date().toISOString(), ...a); }
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function usd(n) { return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }
function toMinutes(ts) { return Math.floor(Number(ts || 0) / 60); }
function byNumeric(key, dir = -1) { return (a, b) => (Number(a[key]||0) - Number(b[key]||0)) * dir; }
function shortWallet(name) { return (!name) ? "anon" : name.startsWith("0x") ? name.slice(0,6)+"…"+name.slice(-4) : (name.length>16?name.slice(0,16)+"…":name); }

// ---------------- “Wow-mode” helpers for fallback headlines ----------------
const LEAGUE_EMOJI = {
  nba:"🏀", nfl:"🏈", mlb:"⚾", nhl:"🏒", ufc:"🥊", mma:"🥊",
  soccer:"⚽", epl:"🏴", laliga:"🇪🇸", seriea:"🇮🇹", bundesliga:"🇩🇪", mls:"🇺🇸",
  ncaab:"🏀", ncaaf:"🏈", tennis:"🎾", atp:"🎾", wta:"🎾", golf:"⛳", pga:"⛳",
  f1:"🏎️", motogp:"🏍️", boxing:"🥊", sports:"🔥"
};
function usdShort(x){ const n=Number(x||0); if(n>=1_000_000)return "$"+(n/1_000_000).toFixed(1)+"M"; if(n>=1_000)return "$"+(n/1_000).toFixed(1)+"K"; return usd(n); }
function leagueBadge(h){ const k=(h.league||"").toLowerCase().replace(/\s+/g,""); return LEAGUE_EMOJI[k]||"🔥"; }
function marketName(h){ return h.marketTitle||h.eventTitle||h.league||(h.marketId?h.marketId.slice(0,10)+"…":"Sports"); }
function wowFormat(highlights){
  const lines=[];
  for(const h of highlights){
    const badge=leagueBadge(h), actor=shortWallet(h.actor), label=marketName(h);
    if(h.type==="WHALE_SINGLE"){ lines.push(`- ${badge} ${actor} ${(h.side==="BUY"?"buys":"sells")} ${usdShort(h.amountUsd)} on ${label} — whale spotted!`); continue; }
    if(h.type==="WHALE_RUN"){ const split=(h.buysUsd||h.sellsUsd)?` (${usdShort(h.buysUsd)} buy / ${usdShort(h.sellsUsd)} sell)`:""; const burst=h.bestWindowMin?` in ${h.bestWindowMin}m`:""; lines.push(`- ${badge} ${actor} runs ${h.trades} bets${burst} totalling ${usdShort(h.totalUsd)}${split} on ${label}!`); continue; }
    if(h.type==="RAPID_FIRE"){ const tot=h.totalUsd?` — ${usdShort(h.totalUsd)}`:""; lines.push(`- ${badge} ${actor} fires ${h.count} quick bets in ${h.windowMin}m on ${label}${tot} ⚡`); continue; }
    if(h.type==="MARKET_SURGE"){ lines.push(`- ${badge} Market surge: ${label} sees ${usdShort(h.totalUsd)} across ${h.count} trades — action heating up!`); continue; }
    lines.push(`- ${badge} ${label} — ${usdShort(h.totalUsd||h.amountUsd||(h.buysUsd||0)+(h.sellsUsd||0))}`);
  }
  return lines.join("\n");
}

// ---------------- HTTP ----------------
async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} @ ${url}\n${body}`);
  }
  return res.json();
}

// ---------------- Data API: trades (paginated) ----------------
async function fetchTradesWindow({ hours = WINDOW_H, minUsd = MIN_USD, takerOnly = !!TAKER_ONLY, limit = 500, maxPages = MAX_PAGES }) {
  const since = Math.floor(Date.now()/1000) - hours*3600;
  let offset = 0, page = 0;
  const all = []; const seen = new Set();
  while (page < maxPages) {
    const url = DATA(`/trades?limit=${limit}&offset=${offset}&takerOnly=${takerOnly?"true":"false"}&filterType=CASH&filterAmount=${minUsd}&since=${since}&hours=${hours}`);
    const json = await getJson(url);
    const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
    if (!rows.length) break;

    for (const t of rows) {
      const id = t?.transactionHash ? `${t.transactionHash}:${t?.logIndex ?? ""}` : JSON.stringify([t?.txid, t?.ts, t?.amount, t?.price, t?.market]);
      if (seen.has(id)) continue;
      seen.add(id); all.push(t);
    }
    log(`Page ${page} got=${rows.length} total=${all.length}`);
    if (rows.length < limit) break;
    offset += limit; page++; await sleep(40);
  }
  return { trades: all, since, hours, pages: page+1 };
}

// ---------------- Gamma: active sports events ----------------
async function fetchSportsEvents() {
  const url = GAMMA(`/events?active=true&tag_slug=sports&limit=500`);
  const json = await getJson(url);
  const events = json?.events || json?.data || [];
  const byConditionId = new Map();
  for (const ev of events) {
    const conds = ev?.condition_ids || [];
    for (const cid of conds) {
      byConditionId.set(cid, {
        event_title: ev?.title || ev?.name,
        league: ev?.league || (Array.isArray(ev?.tags) ? ev.tags.find(t => LEAGUE_RX.test(t)) : undefined) || "sports",
        tags: ev?.tags || [],
      });
    }
  }
  return { events, byConditionId };
}

// ---------------- CLOB: markets (hardened + paginated) ----------------
async function fetchClobMarketsIndex() {
  let cursor = undefined; let markets = []; let guard = 0;
  while (guard++ < 999) {
    const qs = new URLSearchParams(); qs.set("limit","1000"); if (cursor) qs.set("cursor",cursor);
    const url = CLOB(`/markets?${qs.toString()}`);
    const json = await getJson(url);
    let page = []; let next = undefined;
    if (Array.isArray(json)) { page = json; next = json?.next_cursor || json?.nextCursor; }
    else if (Array.isArray(json?.data)) { page = json.data; next = json?.next_cursor || json?.nextCursor; }
    else if (Array.isArray(json?.markets)) { page = json.markets; next = json?.next_cursor || json?.nextCursor; }
    else if (typeof json?.markets === "number") break; // summary only
    else break;

    if (page.length) markets.push(...page);
    if (!next) break; cursor = next; await sleep(30);
  }
  const byCid = new Map(), byMarketId = new Map();
  for (const m of markets) {
    const cid = m?.conditionId || m?.condition_id;
    const mid = m?.id || m?.marketId || m?.hash;
    if (cid) byCid.set(cid, m);
    if (mid) byMarketId.set(mid, m);
  }
  return { markets, byCid, byMarketId };
}

// ---------------- Trade normalization (matches your web app) ----------------
function normalizeTrade(t) {
  // USD: prefer `size` like the UI; then fallbacks; else amount * price
  const shares = num(t?.amount);
  const price  = num(t?.price);
  const candidates = [
    t?.size, t?.usd_amount, t?.usdAmount, t?.value, t?.valueUsd,
    t?.notional, t?.cash, t?.cost
  ].map(num).filter(v => v > 0);
  const usdAmt = (candidates.length ? candidates[0] : (shares * price)) || 0;

  // Actor (exactly how your UI resolves it)
  const actor =
    t?.name || t?.username || t?.pseudonym ||
    t?.proxyWallet || t?.account || t?.address || "anon";

  return {
    ts: num(t?.timestamp || t?.ts),
    side: String(t?.side || t?.takerSide || "").toUpperCase(), // BUY|SELL
    amountUsd: usdAmt, shares, price,
    marketId: t?.market || t?.marketId || t?.id || t?.hash || t?.conditionId || t?.condition_id,
    conditionId: t?.conditionId || t?.condition_id,
    clobId: t?.market || t?.marketId || t?.id || t?.hash,
    title: t?.title || t?.question || t?.marketTitle, // keep UI-provided title
    actor,
    tx: t?.transactionHash || t?.txid,
  };
}

// ---------------- Sports-only filter (fast pass) ----------------
function buildSportsFilter({ eventsIndex, clobIndex }) {
  const sportsConditionIds = new Set(eventsIndex?.byConditionId ? eventsIndex.byConditionId.keys() : []);
  const sportsClobIds = new Set();
  if (eventsIndex?.byConditionId && clobIndex?.byCid) {
    for (const cid of eventsIndex.byConditionId.keys()) {
      const m = clobIndex.byCid.get(cid);
      const mid = m?.id || m?.marketId || m?.hash;
      if (mid) sportsClobIds.add(mid);
    }
  }
  const clobTitle = (id) => {
    const m = clobIndex?.byCid?.get?.(id) || clobIndex?.byMarketId?.get?.(id);
    return m?.question || m?.title || m?.name || "";
  };
  return function isSportsTrade(raw) {
    const t = normalizeTrade(raw);
    if (t.conditionId && sportsConditionIds.has(t.conditionId)) return true;
    if (t.clobId && sportsClobIds.has(t.clobId)) return true;
    if (LEAGUE_RX.test((t.title || "").toLowerCase())) return true;
    if (LEAGUE_RX.test(clobTitle(t.conditionId).toLowerCase())) return true;
    if (LEAGUE_RX.test(clobTitle(t.clobId).toLowerCase())) return true;
    return false;
  };
}

// ---------------- Lazy per-id market resolver (2nd pass) ----------------
const marketMetaCache = new Map();
async function fetchClobMarketMeta(mid) {
  if (!mid) return null;
  if (marketMetaCache.has(mid)) return marketMetaCache.get(mid);
  const candidates = [
    CLOB(`/markets/${mid}`),
    CLOB(`/market?id=${encodeURIComponent(mid)}`),
    CLOB(`/markets?ids=${encodeURIComponent(mid)}`),
  ];
  for (const url of candidates) {
    try {
      const j = await getJson(url);
      const m = Array.isArray(j) ? j[0] :
                Array.isArray(j?.data) ? j.data[0] :
                Array.isArray(j?.markets) ? j.markets[0] : j;
      if (m && (m.question || m.title || m.name || m.conditionId || m.condition_id)) {
        marketMetaCache.set(mid, m); return m;
      }
    } catch { /* try next */ }
  }
  marketMetaCache.set(mid, null);
  return null;
}

async function filterSportsTwoPass(trades, eventsIndex, clobIndex) {
  const isSportsTrade = buildSportsFilter({ eventsIndex, clobIndex });
  const pass1 = [], misses = [];
  for (const r of trades) (isSportsTrade(r) ? pass1 : misses).push(r);
  if (!misses.length) return pass1;

  const sportsConditionIds = new Set(eventsIndex?.byConditionId ? eventsIndex.byConditionId.keys() : []);
  const pass2 = [];
  const MAX_LOOKUPS = 250;
  for (let i=0; i<misses.length && i<MAX_LOOKUPS; i++) {
    const raw = misses[i];
    const t = normalizeTrade(raw);
    const meta = await fetchClobMarketMeta(t.clobId || t.marketId);
    if (!meta) continue;
    const cid = meta.conditionId || meta.condition_id;
    const title = (meta.question || meta.title || meta.name || "").toLowerCase();
    if ((cid && sportsConditionIds.has(cid)) || LEAGUE_RX.test(title)) {
      raw.title = raw.title || meta.question || meta.title || meta.name; // keep good title
      pass2.push(raw);
    }
  }
  return pass1.concat(pass2);
}

// ---------------- Aggregation & detectors ----------------
function groupByTrader(trades) {
  const g = new Map();
  for (const raw of trades) {
    const t = normalizeTrade(raw);
    if (!t.ts || !t.amountUsd) continue;
    const key = t.actor || "anon";
    if (!g.has(key)) g.set(key, { name: key, count: 0, totalUsd: 0, buysUsd: 0, sellsUsd: 0, trades: [], byMarket: new Map() });
    const a = g.get(key);
    a.count += 1; a.totalUsd += t.amountUsd;
    (t.side === "BUY" ? (a.buysUsd += t.amountUsd) : (a.sellsUsd += t.amountUsd));
    a.trades.push(t);

    const mk = t.marketId || "unknown";
    if (!a.byMarket.has(mk)) a.byMarket.set(mk, { marketId: mk, count: 0, totalUsd: 0, buysUsd: 0, sellsUsd: 0, trades: [] });
    const am = a.byMarket.get(mk);
    am.count += 1; am.totalUsd += t.amountUsd;
    (t.side === "BUY" ? (am.buysUsd += t.amountUsd) : (am.sellsUsd += t.amountUsd));
    am.trades.push(t);
  }
  return g;
}

function detectHighlights({ trades }) {
  const out = [];
  const traders = groupByTrader(trades.filter(r => normalizeTrade(r).amountUsd > 0));

  // WHALE_SINGLE
  for (const raw of trades) {
    const t = normalizeTrade(raw);
    if (!t.amountUsd) continue;
    if (t.amountUsd >= WHALE_SINGLE) {
      out.push({ type:"WHALE_SINGLE", key:`WHALE_SINGLE:${t.tx || `${t.marketId}:${t.ts}`}`, ts:t.ts, actor:t.actor, side:t.side, amountUsd:t.amountUsd, marketId:t.marketId, marketTitle:t.title });
    }
  }

  // WHALE_RUN
  for (const [name, a] of traders) {
    if (a.count >= WHALE_RUN_TRADES && a.totalUsd >= WHALE_RUN_TOTAL) {
      const minutes = a.trades.map(t => toMinutes(t.ts)).sort((x,y)=>x-y);
      let best = { len: 0, spanMin: Infinity };
      for (let i=0;i<minutes.length;i++){
        for (let j=i;j<minutes.length;j++){
          const span = minutes[j]-minutes[i]+1, len = j-i+1;
          if (len >= WHALE_RUN_TRADES && span <= 60 && (len/span) > (best.len/best.spanMin)) best = { len, spanMin: span };
        }
      }
      out.push({ type:"WHALE_RUN", key:`WHALE_RUN:${name}:${best.len}:${best.spanMin}`, actor:name, trades:a.count, totalUsd:Math.round(a.totalUsd), buysUsd:Math.round(a.buysUsd), sellsUsd:Math.round(a.sellsUsd), bestWindowMin:isFinite(best.spanMin)?best.spanMin:undefined });
    }
  }

  // RAPID_FIRE
  for (const [name, a] of traders) {
    for (const mk of a.byMarket.values()) {
      if (mk.trades.length < RAPID_COUNT) continue;
      const mins = mk.trades.map(t => toMinutes(t.ts)).sort((x,y)=>x-y);
      for (let i=0;i<=mins.length-RAPID_COUNT;i++) {
        const span = mins[i+RAPID_COUNT-1] - mins[i] + 1;
        if (span <= RAPID_WINDOW_MIN) {
          out.push({ type:"RAPID_FIRE", key:`RAPID_FIRE:${name}:${mk.marketId}:${span}`, actor:name, marketId:mk.marketId, count:RAPID_COUNT, windowMin:span, totalUsd:Math.round(mk.totalUsd) });
          break;
        }
      }
    }
  }

  // MARKET_SURGE — top 5 by USD flow
  const byMarket = new Map();
  for (const raw of trades) {
    const t = normalizeTrade(raw);
    if (!t.marketId || !t.amountUsd) continue;
    if (!byMarket.has(t.marketId)) byMarket.set(t.marketId, { marketId: t.marketId, totalUsd: 0, count: 0, buysUsd: 0, sellsUsd: 0, title: t.title });
    const m = byMarket.get(t.marketId);
    m.totalUsd += t.amountUsd; m.count += 1; m.title = m.title || t.title;
    (t.side === "BUY" ? (m.buysUsd += t.amountUsd) : (m.sellsUsd += t.amountUsd));
  }
  const surge = [...byMarket.values()].sort(byNumeric("totalUsd", -1)).slice(0, 5);
  for (const m of surge) out.push({ type:"MARKET_SURGE", key:`MARKET_SURGE:${m.marketId}`, marketId:m.marketId, marketTitle:m.title, totalUsd:Math.round(m.totalUsd), count:m.count, buysUsd:Math.round(m.buysUsd), sellsUsd:Math.round(m.sellsUsd) });

  return out;
}

// ---------------- Enrichment ----------------
async function enrichWithEvents(highlights, { eventsIndex, clobIndex }) {
  for (const h of highlights) {
    const id = h.marketId;
    const m = clobIndex?.byCid?.get?.(id) || clobIndex?.byMarketId?.get?.(id);
    if (m) {
      // do NOT overwrite a title we already have from the trade row
      h.marketTitle = h.marketTitle || h.eventTitle || m?.question || m?.title || m?.name;
    }
    const ev = eventsIndex?.byConditionId?.get?.(id);
    if (ev) { h.eventTitle = ev.event_title; h.league = ev.league; }
  }
  return highlights;
}

// ---------------- GPT headlines ----------------
async function generateHeadlines(highlights) {
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = `
You are a witty, credible sports betting commentator for Redmen.
Write short, punchy headlines (<= 120 chars) that make traders say "wow".
Use K/M notation ($12.3K / $1.2M). Mention team/event/league if available.
Include actor short tag and side when present. No invented outcomes. List only.
`.trim();

  const shaped = highlights.map(h => ({
    type: h.type,
    league_emoji: (LEAGUE_EMOJI[(h.league||"").toLowerCase().replace(/\s+/g,"")] || "🔥"),
    market: marketName(h),
    actor_short: shortWallet(h.actor || ""),
    side: (h.side || "").toLowerCase(),
    amount_main: h.amountUsd || h.totalUsd || ((h.buysUsd||0)+(h.sellsUsd||0)) || 0,
    buys_usd: h.buysUsd || 0,
    sells_usd: h.sellsUsd || 0,
    count: h.count || h.trades || 0,
    minutes: h.windowMin || h.bestWindowMin || null,
  }));

  const prompt = `
Turn these JSON items into MAX ${MAX_TOTAL} bullet headlines. Patterns:
- WHALE_SINGLE: "<emoji> <actor> buys/sells <AMT> on <market> — whale spotted!"
- WHALE_RUN: "<emoji> <actor> runs <COUNT> bets in <MIN>m totalling <AMT> (<BUY>/<SELL>) on <market>!"
- RAPID_FIRE: "<emoji> <actor> fires <COUNT> quick bets in <MIN>m on <market> — <AMT>!"
- MARKET_SURGE: "<emoji> Market surge: <market> sees <AMT> across <COUNT> trades!"
AMT must be compact ($12.3K / $1.2M). Output a plain markdown list.
JSON:
${JSON.stringify(shaped, null, 2)}
`.trim();

  const resp = await client.responses.create({
    model: MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
  });
  return (resp.output_text || "").trim();
}

// ---------------- Main ----------------
(async function main(){
  try {
    log("Fetching trades window…", { hours: WINDOW_H, minUsd: MIN_USD, takerOnly: !!TAKER_ONLY, maxPages: MAX_PAGES });
    const t0 = Date.now();
    const { trades } = await fetchTradesWindow({});
    log("Trades loaded", { count: trades.length, ms: Date.now()-t0 });

    log("Fetching sports events & CLOB markets…");
    const [eventsIndex, clobIndex] = await Promise.all([
      fetchSportsEvents().catch(e => (log("WARN events:", e.message), {})),
      fetchClobMarketsIndex().catch(e => (log("WARN clob:", e.message), {})),
    ]);

    // Two-pass sports filter: fast pass + lazy per-id resolve for misses
    let sportsTrades = await filterSportsTwoPass(trades, eventsIndex, clobIndex);
    log("Sports-only trades", sportsTrades.length);

    // Top traders debug
    {
      const actors = new Map();
      for (const r of sportsTrades) {
        const t = normalizeTrade(r); if (!t.amountUsd) continue;
        const key = t.actor || "anon";
        actors.set(key, (actors.get(key)||0) + t.amountUsd);
      }
      const top = [...actors.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v]) => `${k}: ${usd(v)}`).join(" | ");
      log("Top traders:", top);
    }

    log("Detecting highlights…");
    let highlights = detectHighlights({ trades: sportsTrades });
    highlights = await enrichWithEvents(highlights, { eventsIndex, clobIndex });

    // Rank, dedupe, trim
    const score = h => Math.max(h.amountUsd||0, h.totalUsd||0, (h.buysUsd||0)+(h.sellsUsd||0));
    highlights.sort((a,b)=> score(b)-score(a));
    highlights = highlights.filter((v,i,self)=> self.findIndex(x=>x.key===v.key)===i).slice(0, MAX_TOTAL);

    // Save JSON
    fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), highlights }, null, 2));
    log("Saved", OUT_JSON);

    // Headlines (GPT -> wow fallback)
    let md = "";
    try {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
      log("Calling GPT to draft commentator headlines…");
      const list = await generateHeadlines(highlights);
      const finalList = list && list.trim().length ? list : wowFormat(highlights);
      md = `# Redmen Highlights (${new Date().toLocaleString()})\n\n${finalList}\n`;
      fs.writeFileSync(OUT_MD, md, "utf-8");
      log("Saved", OUT_MD);
    } catch (e) {
      const spicy = wowFormat(highlights);
      md = `# Redmen Highlights (wow-mode fallback)\n\n${spicy}\n`;
      fs.writeFileSync(OUT_MD, md, "utf-8");
      log("GPT step skipped/fallback:", e.message);
    }

    console.log("\n" + md + "\n");
  } catch (e) {
    console.error("FATAL", e.stack || e.message || e);
    process.exitCode = 1;
  }
})();
