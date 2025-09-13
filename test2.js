#!/usr/bin/env node
/**
 * Polymarket Sports Activity Mirror — FAST, NO-MISS, TERMINATES
 *
 * Fixes:
 * - Proper concurrent task queue (no index rewind), so runs always finish.
 * - Cheap, retrying probe (limit=50, timeout=8s). On repeated failure:
 *     split if multi-market, else skip single market and continue.
 * - Safe fetch wrapper with retries for 524/AbortError.
 * - Cold-batch skip keeps things fast (compares probe newest to SINCE-6h).
 * - Progress logs show queue length; no confusing x/y renumbering.
 */

const BASE_GAMMA = "https://gamma-api.polymarket.com";
const BASE_DATA  = "https://data-api.polymarket.com";

// ---------- CLI ----------
const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const m=a.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [a.replace(/^--/,'') , true];
}));

const FAST             = String(args.fast ?? "true").toLowerCase()==="true";
const HOURS            = args.allTime ? null : Number(args.hours ?? 24);
const SINCE            = HOURS==null ? 0 : Math.floor(Date.now()/1000) - HOURS*3600;
const TAKER_ONLY       = (String(args.takerOnly ?? "false").toLowerCase()==="true");
const MIN_CASH         = Number(args.minCash ?? 100);

const LIMIT_PAGE       = Math.min(Math.max(Number(args.limitPage ?? 300), 1), 500);
const OVERLAP          = Math.min(Math.max(Number(args.overlap ?? 50), 0), Math.max(0, LIMIT_PAGE-1));
const MARKET_BATCH     = Math.min(Math.max(Number(args.marketBatch ?? 12), 1), 25);
const CONCURRENCY      = Math.min(Math.max(Number(args.concurrency ?? 8), 1), 16);

const SEED_LIMIT       = Math.min(Math.max(Number(args.seedLimit ?? 500), 1), 500);
const SEED_MAX_PAGES   = Math.min(Math.max(Number(args.seedMaxPages ?? 3), 0), 100);
const SEED_UNTIL_SINCE = String(args.seedUntilSince ?? "false").toLowerCase()==="true";

const PARANOIA_PAGES   = Math.max(Number(args.paranoiaPages ?? 1), 0);
const MAX_OFFSET       = Math.min(Math.max(Number(args.maxOffset ?? 10000), 1000), 10000);

const OUTFILE          = String(args.outfile ?? "sports-activity.json");
const META_OUT         = String(args.metaOut ?? "meta.json");
const TAG_SLUG         = String(args.tag ?? "sports");

const MAX_TARGETS      = Math.min(Math.max(Number(args.maxTargets ?? 350), 50), 400);
const SKIP_RECENT_HUGE = String(args.skipRecent ?? "true").toLowerCase()==="true";
const MAX_MS           = Math.min(Math.max(Number(args.maxMs ?? 300000), 60000), 600000);
const MAX_REQUESTS     = Math.min(Math.max(Number(args.maxRequests ?? 800), 100), 5000);

// ---------- HTTP (undici keep-alive) ----------
import { Agent, setGlobalDispatcher } from "undici";
const agent = new Agent({ connections: 64, pipelining: 8, keepAliveTimeout: 10_000, keepAliveMaxTimeout: 15_000 });
setGlobalDispatcher(agent);

let EMA = 0;
let REQUESTS = 0;
const HARD_TIMEOUT_MS = 30_000; // general
const PROBE_TIMEOUT_MS = 8_000; // probe-only
const RETRIES = 4;
const BACKOFF_MS = 700;

async function getJsonOnce(url, { timeout=HARD_TIMEOUT_MS } = {}){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), timeout);
  const headers = {
    "accept": "application/json",
    "accept-encoding": "gzip, br",
    "x-requested-with": "redmen-fast"
  };
  try{
    const t0=Date.now();
    const res=await fetch(url, { headers, signal: ctrl.signal });
    const ms=Date.now()-t0;
    EMA = EMA===0 ? ms : Math.round(0.25*ms + 0.75*EMA);
    REQUESTS++;
    if(!res.ok){
      const text=await res.text().catch(()=> "");
      console.error(`API_ERR code=${res.status} ms=${ms} url=${url} body=${text.slice(0,160).replace(/\s+/g,' ')}`);
      const err = new Error(`HTTP_${res.status}`); err.code=res.status; throw err;
    }
    return { json: await res.json(), ms };
  } finally{
    clearTimeout(timer);
  }
}

// Safe + retrying
async function safeGetJson(url, opt={}){
  for(let a=1; a<=RETRIES; a++){
    try{
      const out = await getJsonOnce(url, opt);
      return { ...out, ok:true, aborted:false, attempt:a };
    }catch(e){
      const aborted = (e?.name==="AbortError") || (e?.code===524) || String(e?.message||"").includes("AbortError");
      if(a<RETRIES){
        const delay = BACKOFF_MS * Math.pow(2, a-1);
        console.error(`  retry attempt=${a} in ${delay}ms (${aborted?'AbortError':(e?.code||e?.message||'err')})`);
        await new Promise(r=>setTimeout(r, delay));
        continue;
      }
      return { json:null, ok:false, aborted, err:e, attempt:a };
    }
  }
  return { json:null, ok:false, aborted:true, err:new Error("unknown") };
}

// ---------- utils ----------
async function savePretty(path, data){
  const fs=await import("node:fs/promises");
  await fs.writeFile(path, JSON.stringify(data,null,2));
}
function toSec(x){
  if(!x) return 0;
  if(typeof x==="number") return x>1e12?Math.floor(x/1000):Math.floor(x);
  const n=Number(x); if(!Number.isNaN(n)) return n>1e12?Math.floor(n/1000):Math.floor(n);
  const d=new Date(x); return Number.isNaN(d.getTime())?0:Math.floor(d.getTime()/1000);
}
function fmt(n){ const x=Number(n); return Number.isFinite(x)?x.toLocaleString():String(n); }
function bar(p, w=24){ if(!Number.isFinite(p)) p=0; p=Math.max(0,Math.min(1,p)); const f=Math.round(p*w); const b=process.platform==="win32"?"#":"█"; return `[${b.repeat(f)}${" ".repeat(w-f)}]`; }
function byDesc(a,b){ return b-a; }

// dedupe
function dedupeKey(t){
  const id = t.id ?? t.tradeId;
  if(id!=null) return `id:${String(id)}`;
  const tx=(t.transactionHash||"").toLowerCase();
  const li=t.logIndex!=null?String(t.logIndex):"";
  if(tx) return `tx:${tx}|li:${li}`;
  const cid=(t.conditionId||t.market||t.asset||"").toLowerCase();
  const oi=t.outcomeIndex!=null?String(t.outcomeIndex):"";
  const side=t.side??"";
  const sz=t.size??t.amount??"";
  const px=t.price??"";
  const w=(t.proxyWallet||"").toLowerCase();
  const ts=toSec(t.timestamp??t.ts);
  return `ts:${ts}|cid:${cid}|oi:${oi}|side:${side}|sz:${sz}|px:${px}|w:${w}`;
}
function dedupe(rows){
  const seen=new Set(), out=[]; let drops=0, samples=[];
  for(const t of rows){
    const key=dedupeKey(t);
    if(seen.has(key)){ drops++; if(samples.length<3) samples.push(key); }
    else{ seen.add(key); out.push(t); }
  }
  return { out, drops, unique: seen.size, samples };
}

// coverage stats
const PAGE_STATS=[];
function pageStatPush({page, offset, rows, kept}){
  let oldest=Infinity, newest=-Infinity, flips=false;
  for(let i=0;i<rows.length;i++){
    const ts=toSec(rows[i].timestamp??rows[i].ts);
    if(ts){ oldest=Math.min(oldest, ts); newest=Math.max(newest, ts); }
    if(i>0){
      const prev=toSec(rows[i-1].timestamp??rows[i-1].ts);
      if(prev && ts && prev < ts) flips=true; // expect DESC
    }
  }
  PAGE_STATS.push({ page, offset, got: rows.length, kept, oldest, newest, flips });
}
function printPageSample(){
  const flipsCount = PAGE_STATS.filter(p => p.flips).length;
  console.error(`pages=${PAGE_STATS.length} flips=${flipsCount} emaMs=${EMA}`);
  console.error("page.sample", PAGE_STATS.slice(0,3), "...", PAGE_STATS.slice(-3));
}

// ---------- Gamma ----------
async function getSportsTagId(slug){
  const { json, ok } = await safeGetJson(`${BASE_GAMMA}/tags/slug/${encodeURIComponent(slug)}`);
  if(!ok || !json?.id) throw new Error(`Tag not found: ${slug}`);
  return json.id;
}

async function getRecentSportsMarkets(tagId, want=MAX_TARGETS){
  const ids = new Map(); // cid -> { eventId, updatedAt, volume24hr }
  async function scan(orderField){
    const LIMIT=200; let off=0;
    for(;;){
      const u=new URL(`${BASE_GAMMA}/markets`);
      u.searchParams.set("tag_id", String(tagId));
      u.searchParams.set("active","true");
      u.searchParams.set("limit", String(LIMIT));
      u.searchParams.set("offset", String(off));
      u.searchParams.set("order", orderField);
      u.searchParams.set("ascending","false");
      const { json: arr } = await safeGetJson(u.toString());
      if(!Array.isArray(arr) || arr.length===0) break;
      for(const m of arr){
        const cid=(m?.conditionId||m?.condition_id||m?.questionID||m?.clobTokenId||"").toLowerCase();
        if(!cid || cid.length!==66) continue;
        const evId=m?.eventId ?? m?.event_id ?? m?.event?.id ?? null;
        const updatedAt=toSec(m?.updatedAt);
        const vol24=Number(m?.volume24hr ?? m?.volume24hrClob ?? 0) || 0;
        const prev=ids.get(cid);
        if(!prev || vol24>(prev.volume24hr||0) || updatedAt>(prev.updatedAt||0)){
          ids.set(cid,{eventId:evId, updatedAt, volume24hr:vol24});
        }
      }
      if(ids.size>=want && orderField==="volume24hr") break;
      if(arr.length<LIMIT) break;
      off += LIMIT;
    }
  }
  await scan("volume24hr");
  if(ids.size < want/2) await scan("updatedAt");
  const ranked=[...ids.entries()].sort((a,b)=>{
    const A=a[1], B=b[1];
    const v=(B.volume24hr||0)-(A.volume24hr||0);
    return v!==0? v : (B.updatedAt||0)-(A.updatedAt||0);
  }).map(([cid,meta])=>({cid, ...meta}));
  return ranked.slice(0, want);
}

// ---------- seed from global head ----------
async function seedHotFromGlobal(){
  console.error(`[0/4] Seeding hot IDs from global head: limit=${SEED_LIMIT}, maxPages=${SEED_MAX_PAGES}, untilSince=${SEED_UNTIL_SINCE}`);
  let offset=0;
  const hotMarkets=new Set(), hotEvents=new Set();
  for(let page=1; page<=SEED_MAX_PAGES; page++){
    const u=new URL(`${BASE_DATA}/trades`);
    u.searchParams.set("limit", String(SEED_LIMIT));
    u.searchParams.set("offset", String(offset));
    u.searchParams.set("takerOnly", String(false));
    u.searchParams.set("filterType","CASH");
    u.searchParams.set("filterAmount", String(MIN_CASH));
    const { json: rows } = await safeGetJson(u.toString());
    if(!Array.isArray(rows) || rows.length===0) break;

    const ts = rows.map(r=>toSec(r.timestamp||r.ts)).sort(byDesc);
    const oldest = Math.min(...ts), newest=Math.max(...ts);

    let km=0, ke=0;
    for(const r of rows){
      const cid=(r.market||r.asset||r.conditionId||"").toLowerCase();
      if(cid && cid.length===66){ hotMarkets.add(cid); km++; }
      const ev = r.eventId ?? r.event_id ?? null;
      if(ev!=null){ hotEvents.add(ev); ke++; }
    }
    console.error(`  seed page ${page} off=${offset} got=${fmt(rows.length)} kept=${fmt(rows.length)} oldest=${oldest} (${new Date(oldest*1e3).toISOString()}) newest=${newest} (${new Date(newest*1e3).toISOString()}) hotEvents=${hotEvents.size} hotMarkets=${hotMarkets.size}`);

    if(SEED_UNTIL_SINCE && oldest<=SINCE) break;
    offset += (SEED_LIMIT - Math.min(50, Math.max(10, Math.floor(SEED_LIMIT/10))));
    if(offset>=MAX_OFFSET){ console.error(`  seed offset>${MAX_OFFSET} stop`); break; }
  }
  return { hotMarkets, hotEvents };
}

// ---------- /trades helpers ----------
function mkTradesUrlBase(){
  const u=new URL(`${BASE_DATA}/trades`);
  u.searchParams.set("takerOnly", String(TAKER_ONLY));
  u.searchParams.set("filterType","CASH");
  u.searchParams.set("filterAmount", String(MIN_CASH));
  return u;
}

// Run one batch (ids = array of market cids). Returns control flags.
async function runMarketBatch(ids, rowsSink){
  // Cheap probe
  const probeBase=mkTradesUrlBase(); probeBase.searchParams.set("market", ids.join(","));
  const probe = new URL(probeBase); probe.searchParams.set("limit", "50"); probe.searchParams.set("offset","0");
  const { json: head, ok: probeOK } = await safeGetJson(probe.toString(), { timeout: PROBE_TIMEOUT_MS });

  if(!probeOK || !Array.isArray(head)){
    if(ids.length>1){
      console.error(`    probe aborted/failed — will split batch (len=${ids.length})`);
      return { split:true };
    }else{
      console.error(`    probe aborted/failed — single market; SKIP ${ids[0].slice(0,10)}…`);
      return { skip:true };
    }
  }

  if(head.length>0){
    const newest = head.reduce((mx,r)=>Math.max(mx,toSec(r.timestamp||r.ts)||-Infinity), -Infinity);
    if(HOURS!=null && newest!==-Infinity && newest < (SINCE - 6*3600)){
      console.error(`    (skip cold batch newest<<SINCE)`);
      return { cold:true };
    }
  }else{
    // zero on head: likely cold
    console.error(`      page 1 off=0 got=0 (done)`);
    return { cold:true };
  }

  // Page loop
  const base=probeBase;
  let offset=0, page=0, cutoffHit=false, marginLeft=2;

  for(;;){
    page++;
    const url=new URL(base);
    url.searchParams.set("limit", String(LIMIT_PAGE));
    url.searchParams.set("offset", String(offset));
    const t0=Date.now();
    const { json: rows, ok } = await safeGetJson(url.toString());
    if(!ok || !Array.isArray(rows)){
      // transient failure mid-batch: split if multi, else skip single
      if(ids.length>1){
        console.error(`  retry/split hint: aborted/failed ${Date.now()-t0}ms`);
        return { split:true };
      }else{
        console.error(`  aborted/failed on single market — SKIP ${ids[0].slice(0,10)}…`);
        return { skip:true };
      }
    }

    if(rows.length===0){
      console.error(`      page ${page} off=${offset} got=0 (done)`);
      break;
    }

    const kept = HOURS==null ? rows : rows.filter(r => toSec(r.timestamp ?? r.ts) >= SINCE);
    rowsSink.push(...kept);
    pageStatPush({ page, offset, rows, kept: kept.length });

    // Progress (DESC)
    let pct=0, extra="";
    if(HOURS!=null){
      const oldest = rows.reduce((mn,r)=>Math.min(mn, toSec(r.timestamp||r.ts)||Infinity), Infinity);
      const newest = rows.reduce((mx,r)=>Math.max(mx, toSec(r.timestamp||r.ts)||-Infinity), -Infinity);
      const baseDelta = newest - SINCE;
      if(baseDelta>0 && oldest!==Infinity){
        const remain = Math.max(0, oldest - SINCE);
        pct = Math.max(0, Math.min(1, 1 - (remain/baseDelta)));
        extra = ` ${(pct*100).toFixed(1)}%`;
      }
      console.error(`      page ${page} off=${offset} got=${fmt(rows.length)} kept=${fmt(kept.length)} ms=${Date.now()-t0} ${bar(pct)}${extra}`);

      const oldestTs = rows.reduce((mn,r)=>Math.min(mn, toSec(r.timestamp||r.ts)||Infinity), Infinity);
      if(!cutoffHit && oldestTs < SINCE){ cutoffHit=true; marginLeft=2; }
      else if(cutoffHit){
        if(--marginLeft <= 0){ console.error(`      ↳ cutoff reached + margin scanned (2)`); break; }
      }
    }else{
      console.error(`      page ${page} off=${offset} got=${fmt(rows.length)} kept=${fmt(kept.length)} ms=${Date.now()-t0}`);
    }

    if(rows.length < LIMIT_PAGE) break;
    offset += (LIMIT_PAGE - OVERLAP);
    if(offset>=MAX_OFFSET){ console.error(`      offset>${MAX_OFFSET} stop`); break; }
  }

  return { done:true };
}

// ---------- Concurrent task queue ----------
function makeBatches(cids){
  const out=[];
  for(let i=0;i<cids.length;i+=MARKET_BATCH){
    out.push(cids.slice(i, i+MARKET_BATCH));
  }
  return out;
}

function createQueue(initialLists){
  const tasks = initialLists.map(ids => ({ ids, tries:0 }));
  return {
    tasks,
    take(){
      return this.tasks.shift() || null;
    },
    add(idsList){
      for(const ids of idsList) this.tasks.push({ ids, tries:0 });
    },
    size(){ return this.tasks.length; }
  };
}

// ---------- Paranoia head rescan ----------
async function paranoiaHeadScan(targetCids){
  if(PARANOIA_PAGES<=0 || targetCids.length===0) return [];
  console.error(`[3/4] Paranoia: head re-scan (${PARANOIA_PAGES} pages @ offset=0, mode=market)`);
  const all=[];
  for(let i=0;i<targetCids.length;i+=MARKET_BATCH){
    const b=targetCids.slice(i,i+MARKET_BATCH);
    const base=mkTradesUrlBase(); base.searchParams.set("market", b.join(","));
    let offset=0;
    for(let p=1;p<=PARANOIA_PAGES;p++){
      const url=new URL(base); url.searchParams.set("limit", String(LIMIT_PAGE)); url.searchParams.set("offset", String(offset));
      const { json: rows, ok } = await safeGetJson(url.toString());
      if(!ok || !Array.isArray(rows) || rows.length===0) break;
      const kept = HOURS==null ? rows : rows.filter(r => toSec(r.timestamp ?? r.ts) >= SINCE);
      console.error(`    head page ${p} off=${offset} got=${fmt(rows.length)} kept=${fmt(kept.length)}`);
      all.push(...kept);
      if(rows.length < LIMIT_PAGE) break;
      offset += (LIMIT_PAGE - OVERLAP);
    }
  }
  return all;
}

// ---------- Summary ----------
function summarize(finalRows, dedMeta){
  console.error(`[4/4] Summary`);
  printPageSample();
  console.error(`dedupe.unique=${dedMeta.unique} drops=${dedMeta.drops} sampleKeys=${JSON.stringify(dedMeta.samples)}`);
  const keptBySlug=new Map();
  for(const r of finalRows){
    const slug=r.eventSlug||r.slug||"unknown";
    keptBySlug.set(slug, (keptBySlug.get(slug)||0)+1);
  }
  const top=[...keptBySlug.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  console.error("top.kept", top);
}

// ---------- Main ----------
(async function main(){
  const tStart=Date.now();
  try{
    console.error(`Args: fast=${FAST} hours=${HOURS==null?'ALL':HOURS} takerOnly=${TAKER_ONLY} minCash=${MIN_CASH} limitPage=${LIMIT_PAGE} overlap=${OVERLAP} batch=${MARKET_BATCH} conc=${CONCURRENCY} seedLimit=${SEED_LIMIT} seedMaxPages=${SEED_MAX_PAGES} untilSince=${SEED_UNTIL_SINCE} paranoiaPages=${PARANOIA_PAGES} backfillGlobal=${false} maxOffset=${MAX_OFFSET} maxTargets=${MAX_TARGETS} skipRecent=${SKIP_RECENT_HUGE} maxMs=${MAX_MS} maxRequests=${MAX_REQUESTS}`);

    // 1) pick hot markets (Gamma) + optional seed from global head
    console.error(`[1/4] Gamma: derive HOT sports markets (volume24hr/updatedAt)`);
    const tagId = await getSportsTagId(TAG_SLUG);
    const recent = await getRecentSportsMarkets(tagId, MAX_TARGETS);
    let hotCids = recent.map(r=>r.cid);

    const seed = await seedHotFromGlobal();
    const seedCids = [...seed.hotMarkets];
    if(seedCids.length){
      const set = new Set(hotCids);
      for(const cid of seedCids) if(set.has(cid)) continue; else set.add(cid);
      hotCids = [...set].slice(0, MAX_TARGETS);
    }
    console.error(`      focus: markets=${fmt(hotCids.length)} (ranked), from Gamma+seed`);

    // 2) fetch /trades by market batches via concurrent queue
    console.error(`[2/4] Data-API: /trades batched by market (DESC, limit=${LIMIT_PAGE}, overlap=${OVERLAP}, batch=${MARKET_BATCH}, conc=${CONCURRENCY})`);
    const rowsA=[];
    const queue = createQueue(makeBatches(hotCids));
    let processed=0;

    async function worker(){
      while(true){
        const task = queue.take();
        if(!task) break;
        const { ids } = task;
        processed++;
        console.error(`  task #${processed} (markets=${ids.length}) | queue=${queue.size()}`);

        const res = await runMarketBatch(ids, rowsA);

        if(res?.split && ids.length>1){
          const mid=Math.floor(ids.length/2);
          const left=ids.slice(0,mid), right=ids.slice(mid);
          console.error(`      split -> [${left.length}], [${right.length}]`);
          queue.add([left, right]);
        }
        // if skip/cold/done: do nothing, just continue loop
      }
    }
    await Promise.all(Array.from({length:CONCURRENCY}, ()=>worker()));

    // 3) paranoia head scan on top targets (cheap)
    const rowsB = await paranoiaHeadScan(hotCids.slice(0, Math.min(60, hotCids.length)));

    // Merge + dedupe
    const merged = rowsA.concat(rowsB);
    const ded = dedupe(merged);
    const finalRows = ded.out;

    // 4) summary + write
    summarize(finalRows, ded);
    const meta = { args, SINCE, since_iso:new Date(SINCE*1e3).toISOString(), elapsed_ms: Date.now()-tStart, requests: REQUESTS, ema_ms: EMA };
    await savePretty(META_OUT, meta);
    console.error(`[Meta] Saved ${META_OUT}`);

    await savePretty(OUTFILE, finalRows);
    process.stdout.write(JSON.stringify(finalRows));
    console.error(`[][Done] Saved ${OUTFILE}`);
  }catch(e){
    console.error("FATAL (unexpected):", e?.message || e);
    process.exit(1);
  }
})();
