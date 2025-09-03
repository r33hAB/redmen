#!/usr/bin/env node
const BASE_GAMMA = "https://gamma-api.polymarket.com";
const BASE_DATA  = "https://data-api.polymarket.com";

// ---------- CLI ----------
const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const m=a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/,'') , true];
}));
const HOURS   = args.allTime ? null : Number(args.hours ?? 24);
const LIMIT   = Math.min(Math.max(Number(args.limit ?? 10000), 1), 10000);
const OUTFILE = String(args.outfile ?? "sports-activity.json");
const TAG     = String(args.tag ?? "sports");
const INCLUDE_INACTIVE = !!args.includeInactive;
const SINCE   = HOURS == null ? 0 : Math.floor(Date.now()/1000) - HOURS*3600;

// ---------- utils ----------
async function getJson(url, attempt=1){
  const MAX=4, BACKOFF=700;
  try{
    const t0=Date.now(); const res=await fetch(url,{headers:{accept:"application/json"}});
    const ms=Date.now()-t0;
    if(!res.ok){ const text=await res.text().catch(()=> ""); throw new Error(`HTTP ${res.status} @ ${url} :: ${text.slice(0,180)} (${ms}ms)`); }
    const json=await res.json(); return { json, ms };
  }catch(e){
    if(attempt<MAX){ await new Promise(r=>setTimeout(r,BACKOFF*Math.pow(2,attempt-1))); return getJson(url, attempt+1); }
    throw e;
  }
}
async function savePretty(path, data){ const fs=await import("node:fs/promises"); await fs.writeFile(path, JSON.stringify(data,null,2)); }
function toSec(x){ if(!x) return 0; if(typeof x==="number") return x>1e12?Math.floor(x/1000):Math.floor(x);
  const n=Number(x); if(!Number.isNaN(n)) return n>1e12?Math.floor(n/1000):Math.floor(n);
  const d=new Date(x); return Number.isNaN(d.getTime())?0:Math.floor(d.getTime()/1000); }
function fmt(n){ const x=Number(n); return Number.isFinite(x)?x.toLocaleString():String(n); }
function bar(p, width = 24){ if(!Number.isFinite(p)) p=0; p=Math.max(0,Math.min(1,p));
  const filled=Math.round(p*width), block=process.platform==="win32"?"#":"█";
  return `[${block.repeat(filled)}${" ".repeat(width-filled)}]`; }
function dedupe(rows){
  const seen=new Set(), out=[];
  for(const t of rows){
    const key = t.id ?? t.tradeId ??
      (t.transactionHash ? `${t.transactionHash}|${t.logIndex ?? ""}` :
       `${t.timestamp ?? ""}|${t.market ?? t.asset ?? ""}|${t.side ?? ""}|${t.size ?? ""}|${t.price ?? ""}`);
    if(!seen.has(key)){ seen.add(key); out.push(t); }
  }
  return out;
}

// ---------- SPORTS universe: slugs + conditionIds ----------
async function buildSportsUniverse(tagSlug, includeInactive){
  console.error(`[1/4] Gamma: resolve tag "${tagSlug}"…`);
  const { json: tag } = await getJson(`${BASE_GAMMA}/tags/slug/${encodeURIComponent(tagSlug)}`);
  const tagId = tag?.id ?? tag?.data?.id;
  if (!tagId) throw new Error(`Cannot resolve tag id for "${tagSlug}"`);

  const slugs = new Set();
  const cids  = new Set();

  // Events by tag -> slugs
  console.error(`[1.5/4] Gamma: events by tag_id=${tagId} ${includeInactive?"(active+inactive)":"(active only)"}…`);
  const LIMIT_EV=200;
  for (const active of includeInactive ? [true,false] : [true]){
    let off=0, page=0;
    for(;;){
      page++;
      const u = new URL(`${BASE_GAMMA}/events`);
      u.searchParams.set("tag_id", String(tagId));
      u.searchParams.set("limit", String(LIMIT_EV));
      u.searchParams.set("offset", String(off));
      if (active!==false) u.searchParams.set("active","true");
      const { json: arr, ms } = await getJson(u.toString());
      if (!Array.isArray(arr) || arr.length===0){ if(page===1) console.error(`    (no events, ${ms}ms)`); break; }
      let add=0;
      for (const ev of arr){ if (ev?.slug && !slugs.has(ev.slug)){ slugs.add(ev.slug); add++; } }
      console.error(`    page ${page} off=${off} got=${fmt(arr.length)} add=${fmt(add)} cumSlugs=${fmt(slugs.size)} ms=${ms}`);
      if (arr.length < LIMIT_EV) break;
      off += LIMIT_EV;
    }
  }

  // Markets by tag -> conditionIds (+ eventSlug just in case)
  console.error(`[1.6/4] Gamma: markets by tag_id=${tagId} (collect conditionIds + any extra slugs)…`);
  const LIMIT_MK=200; let moff=0, mpage=0;
  for(;;){
    mpage++;
    const u = new URL(`${BASE_GAMMA}/markets`);
    u.searchParams.set("tag_id", String(tagId));
    u.searchParams.set("limit", String(LIMIT_MK));
    u.searchParams.set("offset", String(moff));
    if (!includeInactive) u.searchParams.set("active","true");
    const { json: arr, ms } = await getJson(u.toString());
    if (!Array.isArray(arr) || arr.length===0){ if(mpage===1) console.error(`    (no markets, ${ms}ms)`); break; }
    let addC=0, addS=0;
    for (const m of arr){
      const cid = m?.conditionId || m?.condition_id || m?.questionID || m?.clobTokenId;
      if (cid){ const s=String(cid).toLowerCase(); if(/^0x[0-9a-f]{64}$/.test(s) && !cids.has(s)){ cids.add(s); addC++; } }
      const slug = m?.eventSlug || m?.event_slug || m?.event?.slug;
      if (slug && !slugs.has(slug)){ slugs.add(slug); addS++; }
    }
    console.error(`    page ${mpage} off=${moff} got=${fmt(arr.length)} addCID=${fmt(addC)} addSlugs=${fmt(addS)} cumCID=${fmt(cids.size)} cumSlugs=${fmt(slugs.size)} ms=${ms}`);
    if (arr.length < LIMIT_MK) break;
    moff += LIMIT_MK;
  }

  if (slugs.size===0 && cids.size===0) throw new Error("No sports identifiers collected.");
  return { slugs, cids };
}

// ---------- Global /trades (maker+taker) with dual filter ----------
async function fetchGlobalTradesFiltered(universe){
  console.error(`[2/4] Data-API: /trades (GLOBAL) CASH>=100 ${HOURS==null?'(allTime)':`(last ${HOURS}h)`} limit=${LIMIT} (maker + taker)`);
  let offset=0, page=0, keep=[], ema=0; const alpha=0.25;
  let sort=null, baseDelta=null, last=0;
  const print = s=>{ const pad=Math.max(0,last-s.length); process.stderr.write('\r'+s+' '.repeat(pad)); last=s.length; };
  const end = ()=>{ process.stderr.write('\n'); last=0; };

  // fast membership lookups
  const inSlug = s => !!s && universe.slugs.has(s);
  const inCid  = x => !!x && universe.cids.has(String(x).toLowerCase());

  for(;;){
    page++;
    const url = new URL(`${BASE_DATA}/trades`);
    url.searchParams.set("limit", String(LIMIT));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("filterType", "CASH");
    url.searchParams.set("filterAmount", "100");
    // NOTE: no takerOnly — we want maker + taker like the UI

    const { json: rows, ms } = await getJson(url.toString());
    if (!Array.isArray(rows) || rows.length===0){ end(); break; }

    if (sort==null && rows.length>=2){
      const t0=toSec(rows[0].timestamp ?? rows[0].ts);
      const tL=toSec(rows[rows.length-1].timestamp ?? rows[rows.length-1].ts);
      sort = (t0 >= tL) ? 'DESC' : 'ASC';
      console.error(`      detected sort: ${sort}`);
    }

    let oldest=Infinity, newest=-Infinity;
    for (const r of rows){ const ts=toSec(r.timestamp ?? r.ts); if(ts){ if(ts<oldest) oldest=ts; if(ts>newest) newest=ts; } }
    if (sort==='DESC' && baseDelta==null && HOURS!=null && oldest!==Infinity) baseDelta=Math.max(1, oldest - SINCE);

    // === dual include logic ===
    const filtered = rows.filter(r=>{
      const ts = toSec(r.timestamp ?? r.ts);
      if (HOURS!=null && ts < SINCE) return false;
      const slug = r.eventSlug || r.slug;
      const cid  = r.market || r.asset || r.conditionId;
      return inSlug(slug) || inCid(cid);
    });
    keep.push(...filtered);

    let pct=0, extra="";
    if (sort==='DESC' && HOURS!=null && baseDelta!=null && oldest!==Infinity){
      const remain = Math.max(0, oldest - SINCE);
      pct = Math.max(0, Math.min(1, 1 - (remain/baseDelta)));
      extra = ` ${(pct*100).toFixed(1)}%`;
    }
    print(`      page ${page} off=${offset} got=${fmt(rows.length)} kept=${fmt(filtered.length)} cum=${fmt(keep.length)} ms=${ms} ${bar(pct)}${extra}`);

    if (HOURS!=null){
      if (sort==='DESC' && oldest!==Infinity && oldest < SINCE){ end(); console.error(`      ↳ cutoff reached (oldest < since)`); break; }
      if (sort==='ASC'  && filtered.length===0 && newest!==-Infinity && newest < SINCE){ end(); console.error(`      ↳ no rows in window and page newest < since — stop`); break; }
    }

    ema = ema===0 ? ms : Math.round(alpha*ms + (1-alpha)*ema);
    offset += LIMIT;
    if (offset > 5_000_000){ end(); console.error(`      ↳ safety stop: huge scan`); break; }
  }
  return dedupe(keep);
}

// ---------- quick summary ----------
function summarize(rows){
  const bySlug=new Map(); let minTs=Infinity, maxTs=-Infinity;
  for(const r of rows){ const ts=toSec(r.timestamp ?? r.ts); const slug=r.eventSlug || r.slug || "unknown";
    bySlug.set(slug, (bySlug.get(slug)??0)+1); if(ts&&ts<minTs) minTs=ts; if(ts&&ts>maxTs) maxTs=ts; }
  const top=[...bySlug.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  console.error(`summary: trades=${rows.length} uniqueEvents=${bySlug.size} window=[${new Date(minTs*1000).toISOString()} .. ${new Date(maxTs*1000).toISOString()}]`);
  console.error(`top events:`); for(const [slug,n] of top) console.error(`  ${String(n).padStart(4)}  ${slug}`);
}

// ---------- MAIN ----------
(async function main(){
  try{
    console.error(`Node: ${process.version}`);
    const universe = await buildSportsUniverse(TAG, INCLUDE_INACTIVE);
    console.error(`      sports slugs=${fmt(universe.slugs.size)} conditionIds=${fmt(universe.cids.size)}`);

    const rows = await fetchGlobalTradesFiltered(universe);

    summarize(rows);
    await savePretty(OUTFILE, rows);
    process.stdout.write(JSON.stringify(rows));
    console.error(`[4/4] Done. Saved ${OUTFILE}`);
  }catch(e){
    console.error("FATAL:", e?.message || e);
    process.exit(1);
  }
})();
