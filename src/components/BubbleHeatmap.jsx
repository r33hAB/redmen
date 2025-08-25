import React, { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceCollide, forceManyBody } from "d3-force";

/**
 * Free‑floating heat bubbles (same size).
 * Fill = activityScore heat (green→red). Tooltip shows % split and unique buyers/sellers.
 */
export default function BubbleHeatmap({ markets = [], onSelect, selectedSlug }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 1024, h: 640 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      setSize({
        w: Math.max(520, Math.floor(r?.width || 1024)),
        h: Math.max(560, Math.floor(r?.height || 640)),
      });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const fixedR = useMemo(() => {
    const N = Math.max(1, markets.length);
    const area = size.w * size.h;
    const coverage = 0.30;
    const r = Math.sqrt((coverage * area) / (N * Math.PI));
    return Math.max(26, Math.min(86, r));
  }, [markets.length, size]);

  const nodes = useMemo(() => {
    if (!markets.length) return [];
    const maxA = Math.max(1, ...markets.map((m) => +m.activityScore || 0));
    const cx = size.w / 2, cy = size.h / 2;
    return markets.map((m, i) => ({
      ...m,
      id: m.slug ?? i,
      r: fixedR,
      heat: Math.max(0, Math.min(1, (+m.activityScore || 0) / maxA)),
      x: cx + (Math.random() - 0.5) * (size.w * 0.6),
      y: cy + (Math.random() - 0.5) * (size.h * 0.6),
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      _phase: Math.random() * Math.PI * 2,
    }));
  }, [markets, size, fixedR]);

  const [simNodes, setSimNodes] = useState([]);
  const simRef = useRef(null);
  const liveNodesRef = useRef([]);

  const heatColor      = (t) => `hsl(${130 - 130 * t}, 90%, 55%)`;
  const heatColorOuter = (t) => `hsl(${130 - 130 * t}, 70%, 25%)`;
  const formatUSD = (n = 0) =>
    Number(n).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  function bounce(n) {
    const R = n.r + 2;
    const left = R, right = size.w - R, top = R, bottom = size.h - R;
    if (n.x < left)        { n.x = left;   n.vx = Math.abs(n.vx) * 0.95; }
    else if (n.x > right)  { n.x = right;  n.vx = -Math.abs(n.vx) * 0.95; }
    if (n.y < top)         { n.y = top;    n.vy = Math.abs(n.vy) * 0.95; }
    else if (n.y > bottom) { n.y = bottom; n.vy = -Math.abs(n.vy) * 0.95; }
  }

  useEffect(() => {
    if (!nodes.length) { setSimNodes([]); return; }

    const simN = nodes.map((n) => ({ ...n }));
    const sim = forceSimulation(simN)
      .velocityDecay(0.06)
      .force("charge", forceManyBody().strength(-8))
      .force("collide", forceCollide().radius(d => d.r + 2).strength(0.9).iterations(2))
      .alpha(1)
      .alphaDecay(0.006)
      .alphaTarget(0.028);

    simRef.current = sim;
    liveNodesRef.current = simN;

    let windPhase = Math.random() * Math.PI * 2;
    const windSpeed = 0.015;

    let raf = null;
    sim.on("tick", () => {
      const t = performance.now() / 1000;
      windPhase += 0.0012;
      const wx = windSpeed * Math.cos(windPhase);
      const wy = windSpeed * Math.sin(windPhase);

      for (const n of simN) {
        n.vx += 0.018 * Math.sin(n._phase + t * 0.75);
        n.vy += 0.018 * Math.cos(n._phase + t * 0.75);

        // soft containment near walls (no center gravity)
        const margin = n.r * 1.6;
        const k = 0.0009;
        if (n.x < margin)                 n.vx += (margin - n.x) * k;
        if (n.x > size.w - margin)        n.vx -= (n.x - (size.w - margin)) * k;
        if (n.y < margin)                 n.vy += (margin - n.y) * k;
        if (n.y > size.h - margin)        n.vy -= (n.y - (size.h - margin)) * k;

        const maxV = 1.4;
        const s = Math.hypot(n.vx, n.vy);
        if (s > maxV) { n.vx = (n.vx / s) * maxV; n.vy = (n.vy / s) * maxV; }

        bounce(n);
      }

      if (!raf) {
        raf = requestAnimationFrame(() => { setSimNodes([...simN]); raf = null; });
      }
    });

    return () => { sim.stop(); if (raf) cancelAnimationFrame(raf); simRef.current = null; };
  }, [nodes, size]);

  // drag with capture‑only move + click/drag threshold
  const dragState = useRef({ startX: 0, startY: 0, dragging: false, activeId: null });

  function svgPointFromClient(target, e) {
    const svg = target.ownerSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  function makeDragHandlers(node) {
    return {
      onPointerDown: (e) => {
        e.preventDefault(); e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragState.current = { startX: e.clientX, startY: e.clientY, dragging: false, activeId: e.pointerId };
        node.vx = 0; node.vy = 0;
      },
      onPointerMove: (e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId) || dragState.current.activeId !== e.pointerId) return;
        const dx = e.clientX - dragState.current.startX;
        const dy = e.clientY - dragState.current.startY;
        if (Math.hypot(dx, dy) > 5) dragState.current.dragging = true;
        const { x, y } = svgPointFromClient(e.currentTarget, e);
        node.x = x; node.y = y;
        setSimNodes([...liveNodesRef.current]);
      },
      onPointerUp: (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        }
        node.vx += (Math.random() - 0.5) * 0.5;
        node.vy += (Math.random() - 0.5) * 0.5;
        if (!dragState.current.dragging) onSelect && onSelect(node);
        dragState.current = { startX: 0, startY: 0, dragging: false, activeId: null };
        simRef.current && simRef.current.alphaTarget(0.035).restart();
        setTimeout(() => simRef.current && simRef.current.alphaTarget(0.028), 120);
      },
      onPointerCancel: () => {
        dragState.current = { startX: 0, startY: 0, dragging: false, activeId: null };
      }
    };
  }

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "70vh" }}>
      <svg width={size.w} height={size.h} style={{ display: "block" }}>
        <defs>
          {simNodes.map((b) => (
            <radialGradient id={`heat-${b.id}`} key={b.id} cx="50%" cy="50%" r="65%">
              <stop offset="0%"  stopColor={heatColor(b.heat)} />
              <stop offset="70%" stopColor={heatColor(b.heat)} stopOpacity="0.85" />
              <stop offset="100%" stopColor={heatColorOuter(b.heat)} stopOpacity="1" />
            </radialGradient>
          ))}
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#000" floodOpacity="0.25" />
          </filter>
          <filter id="selGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#7aa2ff" floodOpacity="0.75" />
          </filter>
        </defs>

        {simNodes.map((b) => {
          const isSelected = b.slug === selectedSlug;
          const title = (b.title || b.slug || "Market").toString();
          const titleShort = title.length > 30 ? title.slice(0, 29) + "…" : title;

          const buy = Math.max(0, +b.buys || 0);
          const sell = Math.max(0, +b.sells || 0);
          const tot = Math.max(1, buy + sell);
          const buyPct = Math.round((buy / tot) * 100);
          const sellPct = 100 - buyPct;

          const drag = makeDragHandlers(b);

          return (
            <g key={b.id} transform={`translate(${b.x},${b.y})`} style={{ cursor: "grab" }} {...drag}>
              <circle
                r={b.r}
                fill={`url(#heat-${b.id})`}
                stroke={isSelected ? "#7aa2ff" : "#0e1835"}
                strokeWidth={isSelected ? 2 : 1.25}
                filter={isSelected ? "url(#selGlow)" : "url(#glow)"}
              />
              <ellipse
                rx={b.r * 0.55}
                ry={b.r * 0.38}
                cx={-b.r * 0.25}
                cy={-b.r * 0.3}
                fill="rgba(255,255,255,0.10)"
              />
              <text
                textAnchor="middle"
                dy="0.35em"
                style={{ fontSize: 12, fontWeight: 600, fill: "rgba(234,241,255,0.92)" }}
              >
                {titleShort}
              </text>
              <title>
                {title} — heat {Math.round(b.heat * 100)}% • flow {formatUSD(b.totalUSD)}
                {`\nBuy ${buyPct}% (${b.uniqueBuyers || 0} unique) / Sell ${sellPct}% (${b.uniqueSellers || 0} unique)`}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
