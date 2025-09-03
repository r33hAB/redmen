#!/usr/bin/env node
/**
 * Fetch ALL Polymarket Activity for SPORTS with >= $100 trades (takerOnly),
 * mirroring the Activity page filters, and print as JSON.
 *
 * Usage (Node 18+):  node fetch-sports-activity.mjs > out.json
 *
 * What it does:
 *  1) Gamma -> /tags/slug/sports  -> resolve tag id
 *  2) Gamma -> /events?tag_id={id}&active=true (paginated) -> collect event IDs
 *  3) Data-API -> /trades?filterType=CASH&filterAmount=100&takerOnly=true&eventId=...
 *     (chunked eventId lists + paginated with limit/offset) -> collect all trades
 *  4) De-dupe and emit JSON; also saves to sports-activity.json
 */

const BASE_GAMMA = "https://gamma-api.polymarket.com";
const BASE_DATA  = "https://data-api.polymarket.com";

// Tunables
const EVENT_PAGE_LIMIT = 200;        // Gamma events page size
const TRADE_PAGE_LIMIT = 10000;      // Data-API allows up to 10000
const MAX_OFFSET       = 10000;      // Per docs, offset <= 10000 per request
const EVENTID_CHUNK    = 50;         // Keep URLs reasonable; adjust if needed
const CONCURRENT_FETCH = 3;          // Concurrent trade page fetches per chunk
const RETRIES          = 4;          // Simple retry attempts
const RETRY_MS         = 800;        // Base backoff ms

// Minimal fetch wrapper with retries
async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { "accept": "application/json" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} @ ${url} :: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } catch (err) {
    if (attempt < RETRIES) {
      const delay = RETRY_MS * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
      return getJson(url, attempt + 1);
    }
    throw err;
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getSportsTagId() {
  const url = `${BASE_GAMMA}/tags/slug/sports`;
  const tag = await getJson(url);
  if (!tag?.id && !tag?.data?.id) {
    throw new Error("Could not resolve 'sports' tag id from Gamma.");
  }
  // Some Mintlify examples wrap data; support both shapes.
  return tag.id || tag.data.id;
}

async function getAllSportsEventIds(sportsTagId) {
  let offset = 0;
  const ids = new Set();

  while (true) {
    const url = `${BASE_GAMMA}/events?tag_id=${encodeURIComponent(sportsTagId)}&active=true&limit=${EVENT_PAGE_LIMIT}&offset=${offset}`;
    const page = await getJson(url);

    if (!Array.isArray(page) || page.length === 0) break;

    for (const ev of page) {
      if (ev?.id != null) ids.add(ev.id);
    }

    if (page.length < EVENT_PAGE_LIMIT) break;
    offset += EVENT_PAGE_LIMIT;
  }

  if (ids.size === 0) {
    // Fallback: also try without active filter, in case we want *all* sports events historically.
    let offset2 = 0;
    while (true) {
      const url2 = `${BASE_GAMMA}/events?tag_id=${encodeURIComponent(sportsTagId)}&limit=${EVENT_PAGE_LIMIT}&offset=${offset2}`;
      const page2 = await getJson(url2);
      if (!Array.isArray(page2) || page2.length === 0) break;
      for (const ev of page2) if (ev?.id != null) ids.add(ev.id);
      if (page2.length < EVENT_PAGE_LIMIT) break;
      offset2 += EVENT_PAGE_LIMIT;
    }
  }

  if (ids.size === 0) {
    throw new Error("No sports events returned by Gamma. Aborting.");
  }

  return Array.from(ids);
}

async function getAllTradesForEventIdChunk(eventIds) {
  // Paginates over /trades for a set of eventIds
  // Returns an array of trade objects.
  let results = [];
  // The Data-API caps offset<=10000, so do multiple passes if needed.
  // We'll loop offsets 0..MAX_OFFSET in steps of TRADE_PAGE_LIMIT; if we hit a short page, we stop early.

  for (let startOffset = 0; startOffset <= MAX_OFFSET; startOffset += TRADE_PAGE_LIMIT) {
    let localDone = false;
    let offset = startOffset;

    // inner loop to march this window; we can parallelize by issuing several offsets at once
    while (!localDone && offset < startOffset + TRADE_PAGE_LIMIT) {
      // prepare a batch of concurrent requests
      const batch = [];
      for (let i = 0; i < CONCURRENT_FETCH && (offset + i * TRADE_PAGE_LIMIT) < (startOffset + TRADE_PAGE_LIMIT); i++) {
        const currOffset = offset + i * TRADE_PAGE_LIMIT;
        const url = new URL(`${BASE_DATA}/trades`);
        url.searchParams.set("limit", String(TRADE_PAGE_LIMIT));
        url.searchParams.set("offset", String(currOffset));
        url.searchParams.set("takerOnly", "true");
        url.searchParams.set("filterType", "CASH");
        url.searchParams.set("filterAmount", "100");
        url.searchParams.set("eventId", eventIds.join(","));
        batch.push(getJson(url.toString()).then(arr => ({ arr, currOffset })));
      }

      const batchResults = await Promise.all(batch);
      // append and decide if we should continue
      let anyFull = false;
      for (const { arr } of batchResults) {
        if (Array.isArray(arr) && arr.length > 0) {
          results.push(...arr);
          if (arr.length === TRADE_PAGE_LIMIT) anyFull = true;
        }
      }

      if (!anyFull) localDone = true; // no page in batch was "full", so this chunk is exhausted
      offset += CONCURRENT_FETCH * TRADE_PAGE_LIMIT;
    }
  }

  return results;
}

function dedupeTrades(trades) {
  const seen = new Set();
  const out = [];
  for (const t of trades) {
    const key = `${t.transactionHash ?? ""}|${t.asset ?? ""}|${t.timestamp ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

(async function main() {
  try {
    console.error("[1/4] Resolving 'sports' tag id…");
    const sportsTagId = await getSportsTagId();
    console.error("    sports tag id:", sportsTagId);

    console.error("[2/4] Fetching ALL sports event IDs… (paginated)");
    const eventIds = await getAllSportsEventIds(sportsTagId);
    console.error(`    events: ${eventIds.length}`);

    console.error("[3/4] Downloading ALL ≥$100 taker trades for sports events… (chunked + paginated)");
    const chunks = chunk(eventIds, EVENTID_CHUNK);

    let allTrades = [];
    let processed = 0;

    for (const ids of chunks) {
      processed++;
      console.error(`    chunk ${processed}/${chunks.length} (eventIds: ${ids.length})`);
      const trades = await getAllTradesForEventIdChunk(ids);
      console.error(`      +${trades.length} rows`);
      allTrades.push(...trades);
    }

    console.error(`[3.5/4] De-duping… start=${allTrades.length}`);
    allTrades = dedupeTrades(allTrades);
    console.error(`    after de-dupe=${allTrades.length}`);

    // Optional: ensure sports-only by checking the presence of eventSlug/market titles if returned.
    // Data-API already filtered by eventId; nothing else needed.

    console.error("[4/4] Saving to sports-activity.json and printing to stdout…");
    // Pretty file
    await import('node:fs/promises')
      .then(fs => fs.writeFile('sports-activity.json', JSON.stringify(allTrades, null, 2)));

    // Stream compact JSON to stdout
    process.stdout.write(JSON.stringify(allTrades));

    console.error("Done.");
  } catch (err) {
    console.error("FATAL:", err?.message || err);
    process.exit(1);
  }
})();
