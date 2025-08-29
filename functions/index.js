const functions = require("firebase-functions");
const fetch = require("node-fetch");

// Map /api/<service>/... to correct upstream bases
const UPSTREAMS = {
  gamma: "https://gamma-api.polymarket.com", // /events
  data:  "https://data-api.polymarket.com",  // + /trades  ✅
  clob:  "https://clob.polymarket.com"       // /markets, /prices-history
};

function pickUpstream(path) {
  // path like: /api/data/trades
  const segs = path.split("/").filter(Boolean); // ["api","data","trades"]
  const service = segs[1]; // "data"
  const base = UPSTREAMS[service];
  if (!base) return null;

  // everything after the service
  const rest = segs.slice(2).join("/");       // "trades"
  return `${base}/${rest}`;                   // -> https://polymarket.com/api/data/trades
}

exports.api = functions
  .runWith({ memory: "256MB", timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    try {
      // CORS
      res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") return res.status(204).end();

      const upstream = pickUpstream(req.path);
      if (!upstream) return res.status(404).json({ error: "Unknown upstream" });

      const url = new URL(upstream);
      // preserve query string
      for (const [k, v] of Object.entries(req.query || {})) url.searchParams.set(k, v);

      const r = await fetch(url.toString(), {
        method: "GET",
        headers: { accept: "application/json", "user-agent": "redmen-proxy/1.0" }
      });

      const text = await r.text();
      try {
        const json = JSON.parse(text);
        return res.status(r.status).json(json);
      } catch {
        res.set("Content-Type", "text/plain; charset=utf-8");
        return res.status(r.status).send(`Upstream not JSON from ${url.toString()}\n\n${text.slice(0,1000)}`);
      }
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: "Proxy error", detail: String(e) });
    }
  });
