import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 *  - markets: [{ slug, title, totalUSD, buys, sells, uniqueBuyers, uniqueSellers }]
 *  - onSelect(market)
 *  - selectedSlug?: string
 */
export default function BubbleBoard({ markets = [], onSelect, selectedSlug }) {
  // measure container for responsive grid
  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(1024);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 1024;
      setWrapW(Math.max(360, Math.floor(w)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // columns / cell size
  const COLS = Math.max(2, Math.floor(wrapW / 240));
  const CELL = Math.max(180, Math.floor(wrapW / COLS));
  const PADDING = 12;
  const LABEL_STACK = 44;

  const bubbles = useMemo(() => {
    if (!markets.length) return [];
    const maxFlow = Math.max(...markets.map((m) => Math.max(1, Number(m.totalUSD) || 0)));
    const MAX_R = Math.max(28, (CELL / 2) - PADDING - LABEL_STACK - 8);
    const MIN_R = Math.min(36, MAX_R * 0.6);

    return markets.map((m, i) => {
      const vol = Math.max(1, Number(m.totalUSD) || 1);
      const t = Math.sqrt(vol / maxFlow);
      const r = MIN_R + t * (MAX_R - MIN_R);

      const buy = Math.max(0, Number(m.buys) || 0);
      const sell = Math.max(0, Number(m.sells) || 0);
      const tot = Math.max(1, buy + sell);
      const buyPct = buy / tot;

      return {
        ...m,
        id: m.slug ?? i,
        title: (m.title || String(m.slug || "Market")).toString(),
        r,
        buyPct,
      };
    });
  }, [markets, CELL]);

  const rows = Math.ceil((bubbles.length || 1) / COLS);
  const height = rows * CELL;

  function formatUSD(n = 0) {
    try {
      return Number(n).toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      });
    } catch {
      return `$${Math.round(Number(n) || 0).toLocaleString()}`;
    }
  }

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width="100%" height={height} style={{ display: "block" }}>
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

          const titleMax = b.r < 56 ? 18 : 28;
          const title =
            b.title.length > titleMax ? b.title.slice(0, titleMax - 1) + "…" : b.title;

          const buyP = Math.round(b.buyPct * 100);
          const sellP = 100 - buyP;
          const uniq = `${b.uniqueBuyers ?? 0}/${b.uniqueSellers ?? 0}`;

          const meta = `${formatUSD(b.totalUSD)} • ${buyP}% / ${sellP}% • ${uniq}`;

          const titleW = clamp(72, CELL - 24, Math.round(title.length * 7 + 18));
          const metaW  = clamp(92, CELL - 20, Math.round(meta.length * 6 + 18));

          return (
            <g
              key={b.id}
              transform={`translate(${cx},${cy})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect && onSelect(b)}
            >
              {/* disc */}
              <circle
                r={b.r}
                fill="#1a2238"
                stroke={isSelected ? "#7aa2ff" : "#0e1835"}
                strokeWidth={isSelected ? 2 : 1.5}
                filter={isSelected ? "url(#selGlow)" : undefined}
              />

              {/* ring buy/sell */}
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

              {/* center meta */}
              <text
                textAnchor="middle"
                dy="0.35em"
                style={{
                  fontSize: Math.max(11, Math.min(14, Math.round(b.r / 8))),
                  fill: "#9fb1db"
                }}
              >
                {meta}
              </text>

              {/* title chip (below) */}
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

              {/* meta chip (below) */}
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

              <title>
                {b.title} — {formatUSD(b.totalUSD)} • Buy {buyP}% ({b.uniqueBuyers || 0} unique) / Sell {sellP}% ({b.uniqueSellers || 0} unique)
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function clamp(min, max, v) { return Math.max(min, Math.min(max, v)); }
