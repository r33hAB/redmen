// src/lib/teamDetect.js
// Lightweight "smart" team detector that infers team names directly from market titles.
// No league list required — we parse patterns like "Team A vs Team B", "A @ B", "A at B".

/**
 * Try to extract two team-like spans from a market title.
 * Returns an array of up to two cleaned team strings.
 */
export function extractTeamsFromTitle(title = "") {
  const t = String(title || "").replace(/\s+/g, " ").trim();

  // Consider only the first clause before pipes/colons/dashes (often metadata follows after)
  const main = t.split(/[|:\-–—]/)[0].trim();

  // Common separators between competitors
  const seps = [
    /\s+vs\.?\s+/i,
    /\s+v\.?\s+/i,
    /\s+@\s+/,
    /\s+at\s+/i,
  ];

  let left = null, right = null;
  for (const rx of seps) {
    if (rx.test(main)) {
      const parts = main.split(rx);
      if (parts.length >= 2) {
        left = parts[0];
        right = parts[1];
        break;
      }
    }
  }
  if (!left || !right) return [];

  const clean = (s) => {
    // Strip odds, ranks, emojis, extra punctuation
    return String(s)
      .replace(/\([^)]*\)/g, "")      // remove parentheticals
      .replace(/\[[^\]]*\]/g, "")     // remove brackets
      .replace(/[#*•·]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const a = clean(left);
  const b = clean(right);

  // Ignore if too generic
  const bad = /\b(team|home|away|visitor|over|under|moneyline|spread)\b/i;
  const out = [a, b].filter((x) => x && x.length >= 2 && !bad.test(x));

  return out.slice(0, 2);
}

/**
 * Build a frequency map of team candidates from a list of markets.
 * Each market should have a "title" string.
 */
export function collectTeamsFromMarkets(markets = []) {
  const freq = new Map();
  for (const m of markets) {
    const title = m?.title || m?.question || m?.name || "";
    const teams = extractTeamsFromTitle(title);
    for (const t of teams) {
      const k = t;
      freq.set(k, (freq.get(k) || 0) + 1);
    }
  }
  const list = Array.from(freq.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return list;
}
