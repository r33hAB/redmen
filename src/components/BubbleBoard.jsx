import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 *  - markets: [{ slug, title, totalUSD, buys, sells }]
 *  - onSelect(market)
 *  - selectedSlug?: string
 */
export default function BubbleBoard({ markets = [], onSelect, selectedSlug }) {
  // ---- measure available width to lay out responsively ----
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(1024);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 1024;
      setWrapW(Math.max(320, Math.floor(w)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Decide columns based on width; aim for 220–260px per cell
  const COLS = Math.max(2, Math.floor(wrapW / 240));
  const CELL = Math.max(180, Math.floor(wrapW / COLS)); // actual cell size
  const PADDING = 12; // inner cell padding around bubble
  const LABEL_STACK = 44; // space for title+meta chips under bubble

  // compute bubbles with radius scaling that fits inside the cell
  const bubbles = useMemo(() => {
    if (!markets.length) return [];
    const maxFlow = Math.max(...markets.map((m) => Math.max(1, Number(m.totalUSD) || 0)));
    // The largest circle must leave room for ring (8px) + padding + labels
    const MAX_R = Math.max(
      28,
      (CELL / 2) - PADDING - LABEL_STACK - 8 /* ring thickness margin */
    );
    const MIN_R = Math.min(36, MAX_R * 0.6); // keep small bubbles readable

    return markets.map((m, i) => {
      const vol = Math.max(1, Number(m.totalUSD) || 1);
      const t = Math.sqrt(vol / maxFlow);
      const r = MIN_R + t * (MAX_R - MIN_R);

      const buy = Math.max(0, Number(m.buys) || 0);
      const sell = Math.max(0, Number(m.sells) || 0);
      const tot = Math.max(1, buy + sell);
      const buyPct = buy / tot;
      const sellPct = 1 - buyPct;

      return {
        ...m,
        id: m.slug ?? i,
        title: (m.title ?? String(m.slug ?? "Market")).toString(),
        r,
        buyPct,
        sellPct,
      };
    });
  }, [markets, CELL]);

  // SVG total height from rows
  const rows = Math.ceil((bubbles.length || 1) / COLS);
  const height = rows * CELL;

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width="100%" height={height} style={{ display: "block", background: "transparent" }}>
        <defs>
          <filter id="selGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7aa2ff" floodOpacity="0.45" />
          </filter>
        </defs>

        {bubbles.map((b, i) => {
          const row = Math.floor(i / COLS);
          const col = i % COLS;
          const cx = col * CELL + CELL / 2;
          const cy = row * CELL + CELL / 2;

          const c = 2 * Math.PI * b.r;
          const buyLen = c * b.buyPct;
          const sellLen = c - buyLen;

          const isSelected = b.slug === selectedSlug;

          // Chip text
          const titleMax = b.r < 56 ? 18 : 28;
          const title =
            b.title.length > titleMax ? b.title.slice(0, titleMax - 1) + "…" : b.title;
          const meta = `${formatUSD(b.totalUSD)} • ${Math.round(b.buyPct * 100)}% / ${Math.round(b.sellPct * 100)}%`;

          // Estimate chip widths (keeps them within the cell)
          const titleW = clamp(72, CELL - 24, Math.round(title.length * 7 + 18));
          const metaW  = clamp(72, CELL - 32, Math.round(meta.length * 6 + 18));

          return (
            <g
              key={b.id}
              transform={`translate(${cx},${cy})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect && onSelect(b)}
            >
              {/* INNER DISC */}
              <circle
                r={b.r}
                fill="#1a2238"
                stroke={isSelected ? "#7aa2ff" : "#0e1835"}
                strokeWidth={isSelected ? 2 : 1.5}
                filter={isSelected ? "url(#selGlow)" : undefined}
              />

              {/* PROPORTIONAL RING */}
              <circle
                r={b.r + 6}
                fill="none"
                stroke="#17c964"
                strokeWidth="8"
                strokeDasharray={`${buyLen} ${c - buyLen}`}
                transform="rotate(-90)"
                pathLength={c}
              />
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

              {/* CENTER: keep only the split to avoid clutter */}
              <text
                textAnchor="middle"
                dy="0.35em"
                style={{ fontSize: Math.max(11, Math.min(14, Math.round(b.r / 8))), fill: "#9fb1db" }}
              >
                {meta}
              </text>

              {/* ALWAYS‑BELOW TITLE CHIP */}
              <rect
                x={-titleW / 2}
                y={b.r + 10}
                width={titleW}
                height={22}
                rx={8}
                ry={8}
                fill="#0f162b"
                stroke="#223357"
              />
              <text
                y={b.r + 26}
                textAnchor="middle"
                style={{ fontSize: 12, fontWeight: 600, fill: "#eaf1ff" }}
              >
                {title}
              </text>

              {/* META CHIP (volume + %), also below, consistent across sizes */}
              <rect
                x={-metaW / 2}
                y={b.r + 36}
                width={metaW}
                height={18}
                rx={7}
                ry={7}
                fill="#0c1326"
                stroke="#1a2a57"
              />
              <text
                y={b.r + 49}
                textAnchor="middle"
                style={{ fontSize: 11, fill: "#9fb1db" }}
              >
                {meta}
              </text>

              {/* Tooltip for full title */}
              <title>
                {b.title} — {formatUSD(b.totalUSD)} • Buy {Math.round(b.buyPct * 100)}% / Sell {Math.round(b.sellPct * 100)}%
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- helpers ---------- */
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
function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }
