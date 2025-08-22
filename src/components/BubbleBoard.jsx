import React, { useMemo } from "react";

/**
 * Expects each market to have:
 *  - title: string
 *  - totalUSD: number
 *  - buys: number
 *  - sells: number
 *
 * onSelect(market) will be called on bubble click.
 */
export default function BubbleBoard({ markets = [], onSelect }) {
  // Map markets -> drawable bubbles (radius, proportions, etc.)
  const bubbles = useMemo(() => {
    if (!markets.length) return [];

    const maxFlow = Math.max(...markets.map((m) => Math.max(1, m.totalUSD)));
    const MIN_R = 26;   // visual floor
    const MAX_R = 110;  // visual ceiling

    return markets.map((m, i) => {
      const vol = Math.max(1, m.totalUSD || 1);
      // sqrt scaling → area feels proportional but grid stays usable
      const t = Math.sqrt(vol / maxFlow);
      const r = MIN_R + t * (MAX_R - MIN_R);

      const buy = Math.max(0, m.buys || 0);
      const sell = Math.max(0, m.sells || 0);
      const tot = Math.max(1, buy + sell);
      const buyPct = buy / tot;         // 0..1
      const sellPct = 1 - buyPct;

      return {
        ...m,
        id: m.id ?? i,
        r,
        buyPct,
        sellPct,
      };
    });
  }, [markets]);

  // Simple grid layout (kept like your original)
  const COLS = 5;
  const CELL = 220;
  const width = "100%";
  const height = Math.ceil((bubbles.length || 1) / COLS) * CELL;

  return (
    <svg width={width} height={height} style={{ background: "transparent" }}>
      {bubbles.map((b, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const cx = col * CELL + CELL / 2;
        const cy = row * CELL + CELL / 2;

        // Arc math for proportional ring
        const c = 2 * Math.PI * b.r;               // circumference
        const buyLen = c * b.buyPct;               // green arc length
        const sellLen = c - buyLen;                // red arc length

        // Adaptive text sizing / visibility
        const showTitle = b.r >= 46;               // hide title on tiny bubbles
        const fsTitle = Math.max(12, Math.min(16, Math.round(b.r / 7)));
        const fsSub = Math.max(11, Math.min(14, Math.round(b.r / 8.5)));
        const titleMax = b.r < 56 ? 16 : 22;       // stronger truncation on smaller bubbles
        const title =
          b.title.length > titleMax ? b.title.slice(0, titleMax - 1) + "…" : b.title;

        return (
          <g
            key={b.id}
            transform={`translate(${cx},${cy})`}
            style={{ cursor: "pointer" }}
            onClick={() => onSelect && onSelect(b)}
          >
            {/* INNER DISC */}
            <circle r={b.r} fill="#1a2238" />
            {/* SOFT EDGE */}
            <circle r={b.r} fill="none" stroke="#0e1835" strokeWidth="1.5" />

            {/* PROPORTIONAL RING (two arcs using strokeDasharray) */}
            {/* Green (buy) first, starting at -90deg so 0 is at top */}
            <circle
              r={b.r + 6}
              fill="none"
              stroke="#17c964"
              strokeWidth="8"
              strokeDasharray={`${buyLen} ${c - buyLen}`}
              transform="rotate(-90)"
              pathLength={c}
            />
            {/* Red (sell) immediately after green; offset by buy length */}
            <circle
              r={b.r + 6}
              fill="none"
              stroke="#f31260"
              strokeWidth="8"
              strokeDasharray={`${sellLen} ${c - sellLen}`}
              strokeDashoffset={-buyLen}
              transform="rotate(-90)"
              pathLength={c}
            />

            {/* LABELS */}
            {showTitle && (
              <text
                textAnchor="middle"
                dy="-0.25em"
                style={{
                  fontSize: fsTitle,
                  fontWeight: 600,
                  fill: "#eaf1ff",
                  paintOrder: "stroke",
                  stroke: "rgba(8,12,24,0.55)",
                  strokeWidth: 2,
                }}
              >
                {title}
              </text>
            )}
            <text
              textAnchor="middle"
              dy={showTitle ? "1.2em" : "0.35em"}
              style={{ fontSize: fsSub, fill: "#9fb1db" }}
            >
              {formatUSD(b.totalUSD)} • {Math.round(b.buyPct * 100)}% /
              {Math.round(b.sellPct * 100)}%
            </text>

            {/* Accessible tooltip */}
            <title>
              {b.title} — {formatUSD(b.totalUSD)} • Buy {Math.round(b.buyPct * 100)}% / Sell{" "}
              {Math.round(b.sellPct * 100)}%
            </title>
          </g>
        );
      })}
    </svg>
  );
}

function formatUSD(n = 0) {
  try {
    return Number(n).toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  } catch {
    return `$${Math.round(Number(n) || 0).toLocaleString()}`;
  }
}
