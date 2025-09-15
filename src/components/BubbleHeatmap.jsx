
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * BubbleHeatmap — preserves positions across refreshes, adds slight size boost for hotter bubbles,
 * and runs a gentle force sim (repulsion + drift + soft walls). Labels limited to top movers.
 */
const gamma = (x, g=0.65) => Math.pow(Math.max(0, Math.min(1, x)), g);
const heatColor = (t) => `hsl(${130 - 130 * t}, 92%, ${50 + 10*(1-t)}%)`;
const TOP_LABELS = 18;
const BASE_R = 24;           // base radius
const BOOST = 8;             // extra radius for hottest bubbles (scaled by heat)

export default function BubbleHeatmap({ markets = [], onSelect, selectedId }) {
  const wrapRef  = useRef(null);
  const nodesRef = useRef(new Map()); // id -> node {id,title,totalUSD,act,heat,r,x,y,vx,vy}
  const orderRef = useRef([]);        // stable iteration order
  const [size, setSize] = useState({ w: 1200, h: 560 });
  const [, force] = useState(0);

  // Observe container size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: Math.max(440, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Incrementally update nodes from markets WITHOUT resetting positions
  useEffect(() => {
    const map = nodesRef.current;
    // normalize markets -> stats
    const stats = markets.map((m) => ({
      id: m.conditionId || m.slug || m.title,
      title: m.title || m.slug || "Untitled",
      totalUSD: Number(m.totalUSD ?? m.totals?.totalUSD ?? 0),
      act: Number(m.activityScore ?? 0),
    }));

    const maxAct = Math.max(1, ...stats.map(s => s.act));
    const seen = new Set();

    // upsert existing nodes, tweak size/heat smoothly
    for (const s of stats) {
      seen.add(s.id);
      const heat = gamma(maxAct > 0 ? s.act / maxAct : 0);
      const targetR = BASE_R + BOOST * heat;

      if (!map.has(s.id)) {
        // seed new node near a deterministic grid slot
        const i = orderRef.current.length;
        const seedX = (i % 14) * 86 + 60 + (Math.random()*8-4);
        const seedY = Math.floor(i / 14) * 86 + 60 + (Math.random()*8-4);
        map.set(s.id, {
          id: s.id, title: s.title, totalUSD: s.totalUSD, act: s.act,
          heat, r: targetR, x: seedX, y: seedY, vx: (Math.random()*2-1)*0.3, vy: (Math.random()*2-1)*0.3
        });
        orderRef.current.push(s.id);
      } else {
        const n = map.get(s.id);
        n.title = s.title;
        n.totalUSD = s.totalUSD;
        n.act = s.act;
        n.heat = heat;
        // ease radius toward new target (prevents jumps)
        n.r += (targetR - n.r) * 0.2;
      }
    }

    // remove nodes that disappeared
    for (const id of Array.from(map.keys())) {
      if (!seen.has(id)) {
        map.delete(id);
        orderRef.current = orderRef.current.filter(x => x !== id);
      }
    }
  }, [markets]);

  // top labels by total
  const topIds = useMemo(() => {
    const arr = Array.from(nodesRef.current.values());
    return arr
      .slice()
      .sort((a,b)=> b.totalUSD - a.totalUSD)
      .slice(0, TOP_LABELS)
      .map(n => n.id);
  }, [markets]); // recompute when new data arrives

  const showLabel = (n) => {
    if (!n) return false;
    if (selectedId && n.id === selectedId) return true;
    return topIds.includes(n.id);
  };

  // Force simulation: gentle repulsion + drift + soft walls
  useEffect(() => {
    let raf;
    const step = () => {
      const W = size.w, H = size.h;
      const arr = orderRef.current.map(id => nodesRef.current.get(id)).filter(Boolean);

      // pairwise minimal repulsion
      for (let i=0;i<arr.length;i++) {
        for (let j=i+1;j<arr.length;j++) {
          const a = arr[i], b = arr[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.max(0.001, Math.hypot(dx, dy));
          const min = a.r + b.r + 8;
          if (d < min) {
            const k = (min - d) * 0.035;
            const ux = dx / d, uy = dy / d;
            a.vx -= ux * k; a.vy -= uy * k;
            b.vx += ux * k; b.vy += uy * k;
          }
        }
      }

      // integrate with drift and soft-wall containment
      for (const n of arr) {
        // tiny random drift
        n.vx += (Math.random()*2-1) * 0.02;
        n.vy += (Math.random()*2-1) * 0.02;
        // friction
        n.vx *= 0.985; n.vy *= 0.985;
        // integrate
        n.x += n.vx; n.y += n.vy;
        // walls
        if (n.x < n.r+8) { n.x = n.r+8; n.vx *= -0.6; }
        if (n.x > W - n.r - 8) { n.x = W - n.r - 8; n.vx *= -0.6; }
        if (n.y < n.r+8) { n.y = n.r+8; n.vy *= -0.6; }
        if (n.y > H - n.r - 8) { n.y = H - n.r - 8; n.vy *= -0.6; }
      }

      force(t => t+1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h]);

  const handleClick = (id) => {
    const n = nodesRef.current.get(id);
    if (n && onSelect) onSelect({ conditionId: id, title: n.title });
  };

  const nodes = orderRef.current.map(id => nodesRef.current.get(id)).filter(Boolean);

  return (
    <div ref={wrapRef} style={{ width: "100%", minHeight: 480, position: "relative" }}>
      {nodes.map(n => (
        <div
          key={n.id}
          onClick={() => handleClick(n.id)}
          title={n.title}
          style={{
            position:"absolute",
            left: (n.x - n.r), top: (n.y - n.r),
            width: n.r*2, height: n.r*2, borderRadius: "50%",
            background: heatColor(n.heat),
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,.35))",
            boxShadow: n.id===selectedId ? "0 0 0 3px #fff inset" : "inset 0 0 0 0 rgba(0,0,0,0)",
            cursor: "pointer",
            transition: "box-shadow 120ms ease"
          }}
        />
      ))}
      {nodes.filter(showLabel).map(n => (
        <div
          key={`label-${n.id}`}
          style={{
            position:"absolute",
            transform:"translate(-50%, -50%)",
            left: n.x,
            top: n.y + n.r + 14,
            fontSize: 12,
            color:"#c6cfdb",
            maxWidth: 220,
            whiteSpace:"nowrap",
            overflow:"hidden",
            textOverflow:"ellipsis",
            pointerEvents:"none"
          }}
        >
          {n.title}
        </div>
      ))}
    </div>
  );
}
