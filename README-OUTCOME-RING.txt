Redmen Outcome-Ring Patch
- Replaces board/card ring with OUTCOME split (fallback to buy/sell).
- Normalizes FEED base (auto-append /feed for Cloud Run URLs).
- Adds a dev proxy to Cloud Run.

Apply:
1) Drop these files into your web app, replacing existing ones.
2) Dev with proxy:
   set VITE_FEED_BASE=/feed
   npm run dev
   (Proxy forwards /feed/** to Cloud Run — see vite.config.ts)
   Or direct:
   set VITE_FEED_BASE=https://<your-run-url>
   npm run dev
3) Verify:
   http://localhost:5173/health -> { ok: true }
   Rings show outcome split (e.g., 72/28) instead of 100/0.
