// src/lib/badge.js
// Helpers & labels for Kalshi + Polymarket.
// Exports used across the app:
//   - extractTeamsFromTitle
//   - kalshiYesTeam
//   - kalshiGroupKey   <-- required by BubbleBoard
//   - sourceBadge / sourceBadgeShort
//   - yesNoLabels

function sanitizeToken(token = "") {
  let t = String(token || "").trim();
  t = t.replace(/\s*\?+$/g, "").trim();
  const suffixes = [
    /series winner$/i, /series$/i,
    /winner$/i, /match winner$/i, /game \d+ winner$/i,
    /wins?$/i, /qualifiers?$/i,
    /r point total.*$/i, /\bpoint total.*$/i,
    /\bo\/u.*$/i,
  ];
  for (const rx of suffixes) if (rx.test(t)) t = t.replace(rx, "").trim();
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export function extractTeamsFromTitle(title = "") {
  const raw = String(title || "").replace(/\s+/g, " ").trim();
  if (!raw) return [];

  const base = raw.replace(/[?…\.\s]+$/g, "").trim();

  // Two-team separators
  const parts = base.split(/\s+(?:vs\.?|v\.?|@|at)\s+/i);
  if (parts.length >= 2) {
    return parts.slice(0, 2).map((p) => sanitizeToken(p)).filter(Boolean);
  }

  // Will <team> ... win/cover/etc?
  const m = base.match(/^will\s+(.+?)\s+(?:win|wins?|beat|defeat|cover|qualify|advance)/i);
  if (m) return [sanitizeToken(m[1])].filter(Boolean);

  // Fallback: single cleaned token
  return [sanitizeToken(base)].filter(Boolean);
}

function kalshiYesCode(id = "", slug = "") {
  const s = String(id || slug || "");
  if (!s) return null;
  const parts = s.split("-").map((x) => x.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  if (/^[A-Za-z]{1,4}$/i.test(last)) return last.toUpperCase();
  return null;
}

function mapCodeToTitleTeam(code, titleTeams) {
  if (!code || !titleTeams?.length) return null;
  const c = code.toLowerCase();
  for (const team of titleTeams) {
    const t = String(team).toLowerCase();
    if (t.includes(c)) return team;
  }
  // loose fallback: first letter match
  for (const team of titleTeams) if (String(team).toLowerCase()[0] === c[0]) return team;
  return null;
}

export function kalshiYesTeam(market) {
  const id = String(market?.conditionId || market?.id || "");
  const slug = String(market?.slug || "");
  const code = kalshiYesCode(id, slug);
  const teams = extractTeamsFromTitle(market?.title || market?.slug || "");
  const mapped = mapCodeToTitleTeam(code, teams);
  return mapped || code || "Yes";
}

// --- missing earlier; BubbleBoard imports this ---
export function kalshiGroupKey(market) {
  const s = String(market?.conditionId || market?.slug || "");
  if (!s) return "";
  const parts = s.split("-").map((x) => x.trim()).filter(Boolean);
  if (parts.length <= 1) return s;
  // Drop the final token (typically YES code like SF/NYK etc.)
  return parts.slice(0, -1).join("-");
}

export function kalshiYesLabel(market) {
  const team = kalshiYesTeam(market);
  return `Kalshi — YES: ${team}`;
}

export function sourceBadge(market) {
  const s = String(market?.source || "").toLowerCase();
  if (s === "kalshi") return kalshiYesLabel(market);
  if (s === "polymarket") return "Polymarket";
  return market?.source ? String(market.source) : "Unknown";
}

export function sourceBadgeShort(market) {
  const s = String(market?.source || "").toLowerCase();
  if (s === "kalshi") {
    const team = kalshiYesTeam(market);
    const init = (team || "")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "YES";
    return `K-YES ${init}`;
  }
  if (s === "polymarket") return "PM";
  return "?";
}

// ---------------- Outcome labels chosen by MARKET FORM -----------------------
export function yesNoLabels(market) {
  const src = String(market?.source || "").toLowerCase();
  const title = String(market?.title || market?.slug || "");
  const teams = extractTeamsFromTitle(title);

  // Two-team statement like "A vs B"
  if (teams.length >= 2) {
    if (src === "kalshi") {
      // Kalshi markets are YES on one side; show YES team vs opponent
      const yesTeam = kalshiYesTeam(market);
      const noTeam = teams.find((t) => String(t) !== String(yesTeam)) || "No";
      return { yes: yesTeam, no: noTeam };
    }
    // Polymarket or unknown -> treat Yes=A, No=B
    return { yes: teams[0], no: teams[1] };
  }

  // Single-team proposition ("Will <Team> win ...?") => literal Yes/No
  if (teams.length === 1 && /^will\s/i.test(title)) {
    return { yes: "Yes", no: "No" };
  }

  // Fallback
  return { yes: "Yes", no: "No" };
}
