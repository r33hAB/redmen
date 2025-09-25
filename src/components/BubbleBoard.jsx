// src/components/BubbleBoard.jsx — outcome-first split with lazy details hydrate
import React, { useMemo, useRef, useEffect, useState } from "react";
import { fetchMarketDetail } from "@/lib/api.js";

function compactUSD(v) {
  try {
    return Intl.NumberFormat("en-US", {
      notation: "compact",
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 1,
    }).format(Number(v || 0));
  } catch {
    const n = Number(v || 0);
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
  }
}
const toNum = (x) => (x == null ? 0 : +x || 0);
const pct1 = (p) => (p > 0 && p < 0.1 ? "<0.1%" : p > 99.9 && p < 100 ? ">99.9%" : `${p.toFixed(1)}%`);

// normalize outcomes from array/object shapes
function normalizeOutcomes(src) {
  if (!src) return [];
  if (Array.isArray(src)) {
    return src.map((o) => ({
      label: o.label ?? o.name ?? "",
      usd: toNum(o.usd ?? o.totalUSD ?? o.flowUSD),
    }));
  }
  if (typeof src === "object") {
    return Object.entries(src).map(([label, v]) => ({
      label,
      usd: toNum(v?.usd ?? v?.totalUSD ?? v?.flowUSD),
    }));
  }
  return [];
}

// prefer outcomes; fallback to buy/sell
function computeSplit(m, hydratedOutcomes) {
  const outs = normalizeOutcomes(m?.outcomes?.length ? m.outcomes : hydratedOutcomes);
  if (outs.length >= 2) {
    outs.sort((a, b) => (b.usd || 0) - (a.usd || 0));
    const a = toNum(outs[0].usd);
    const b = toNum(outs[1].usd);
    const tot = a + b;
    if (tot > 0) {
      const pA = (a / tot) * 100;
      return { pA, pB: 100 - pA, mode: "outcomes" };
    }
  }
  const buy = toNum(m?.buyUSD ?? m?.buys ?? m?.totals?.buyUSD);
  const sell = toNum(m?.sellUSD ?? m?.sells ?? m?.totals?.sellUSD);
  const tot = buy + sell;
  if (tot > 0) {
    const pA = (buy / tot) * 100;
    return { pA, pB: 100 - pA, mode: "flow" };
  }
  return { pA: 50, pB: 50, mode: "empty" };
}

export default function BubbleBoard({ markets = [], onSelect, selectedSlug, highlightText="", greyOthers=false }) {
  const wrapRef = useRef(null);
  const [outcomesById, setOutcomesById] = useState({}); // { [id]: normalizedOutcomes[] }

  // Size measure (if you use it elsewhere)
  const [size, setSize] = useState({ w: 1200 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.getBoundingClientRect().width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Determine which ids need hydration (no outcomes in list & not yet fetched)
  const idsNeedingOutcomes = useMemo(() => {
    const needed = [];
    for (const m of markets) {
      const id = m.conditionId || m.slug || m.title;
      const hasListOutcomes = Array.isArray(m?.outcomes) && m.outcomes.length >= 2;
      if (!hasListOutcomes && !outcomesById[id]) needed.push(id);
      if (needed.length >= 30) break; // avoid hammering; fetch first 30
    }
    return needed;
  }, [markets, outcomesById]);

  // Lazy hydrate outcomes for the first page of visible markets
  useEffect(() => {
    if (!idsNeedingOutcomes.length) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all(
          idsNeedingOutcomes.map(async (id) => {
            const detail = await fetchMarketDetail(id, { hours: 6 });
            const src =
              detail?.market?.outcomes ||
              detail?.market?.outcomeTotals ||
              detail?.outcomes ||
              detail?.outcomeTotals;
            const norm = normalizeOutcomes(src);
            if (!cancelled && norm.length >= 2) {
              setOutcomesById((prev) => (prev[id] ? prev : { ...prev, [id]: norm }));
            }
          })
        );
      } catch {
        // ignore individual failures; board will keep showing flow split
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsNeedingOutcomes]);

  const rows = useMemo(() => {
    const out = [];
    markets.forEach((m) => {
      const id = m.conditionId || m.slug || m.title;
      const total = toNum(m.totalUSD ?? m.totals?.totalUSD);
      const ub = toNum(m.uniqueBuyers ?? m.totals?.uniqueBuyers);
      const us = toNum(m.uniqueSellers ?? m.totals?.uniqueSellers);
      const { pA, pB, mode } = computeSplit(m, outcomesById[id]);

      out.push({
        id,
        title: m.title || m.slug || "Untitled",
        total,
        pA,
        pB,
        ub,
        us,
        mode,
      });
    });
    return out;
  }, [markets, outcomesById]);

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(260px, 1fr))`,
        gap: 14,
      }}
    >
      {rows.map((r) => {
        const ring = {
          background: `conic-gradient(#22c55e 0 ${r.pA}%, #f43f5e ${r.pA}% 100%)`,
          borderRadius: "50%",
          width: 120,
          height: 120,
          boxShadow: "inset 0 0 0 10px #0b1015, 0 2px 10px rgba(0,0,0,.35)",
          margin: "0 auto",
        };
        const isSelected = selectedSlug && selectedSlug === r.id;
        const ht = (highlightText||"").toLowerCase();
        const isMatch = ht ? (String(r.title||"").toLowerCase().includes(ht)) : true;
        const muted = ht && greyOthers && !isMatch;
        return (
          <div
            key={r.id}
            onClick={() => onSelect && onSelect({ conditionId: r.id })}
            style={{
              background: "#0f1520",
              opacity: muted ? 0.25 : 1,
              border: isSelected ? "2px solid #3b82f6" : (isMatch ? "1px solid #2b3c52" : "1px dashed #2b3c52"),
              borderRadius: 16,
              padding: 12,
              cursor: "pointer",
            }}
            title={r.mode === "outcomes" ? "Outcome split" : "Buy/Sell split"}
          >
            <div style={ring} />
            <div
              style={{
                textAlign: "center",
                color: "#c6cfdb",
                marginTop: 8,
                fontSize: 12,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {r.title}
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#9ba7b4",
                marginTop: 6,
                fontSize: 12,
              }}
            >
              {compactUSD(r.total)} • {pct1(r.pA)} / {pct1(r.pB)} • {r.ub}/{r.us}
            </div>
          </div>
        );
      })}
    </div>
  );
}
