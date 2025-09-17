import React from "react";
import { splitFrom, usd, num } from "../lib/metrics";

export default function DetailsModal({ market, detail, onClose }) {
  if (!market) return null;

  // Prefer detail.totals when present (fresh aggregation)
  const base = {
    ...market,
    totals: detail?.totals || market?.totals || market?.stats || {},
  };
  const s = splitFrom(base);

  const uBuy = num(
    base?.uniqueBuyers ?? base?.totals?.uniqueBuyers
  );
  const uSell = num(
    base?.uniqueSellers ?? base?.totals?.uniqueSellers
  );
  const trades = num(
    base?.tradeCount ?? base?.totals?.tradeCount
  );

  const title = market.title || market.question || market.name || "Market";

  return (
    <div
      style={overlay}
      onClick={onClose}
    >
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={xbtn}>Close</button>
        </div>

        <div style={chips}>
          <span style={chip}>{usd(s.total)}</span>
          <span style={chip}>buys/sells {usd(s.buy)}/{usd(s.sell)}</span>
          <span style={chip}>unique {uBuy}/{uSell}</span>
          <span style={chip}>trades {trades}</span>
        </div>

        {/* Outcomes box (kept simple; your existing outcome UI can remain) */}
        {detail?.outcomes && (
          <div style={card}>
            <div style={cardTitle}>Outcomes</div>
            <div>
              {Object.entries(detail.outcomes).map(([key, v]) => {
                const oBuy = num(v?.buyUSD);
                const oSell = num(v?.sellUSD);
                const oTotal = num(v?.totalUSD) || (oBuy + oSell);
                const tCnt = num(v?.trades);
                return (
                  <div key={key} style={row}>
                    <div style={{ flex: 1 }}>{key}</div>
                    <div style={mono}>{usd(oTotal)}</div>
                    <div style={{ ...mono, marginLeft: 12 }}>• trades {tCnt}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top bettors */}
        {Array.isArray(detail?.topBettors) && detail.topBettors.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {detail.topBettors.map((b, i) => (
              <div key={i} style={card}>
                <div style={cardTitle}>{b.name || b.display || b.address || "anon"}</div>
                <div style={{ ...mono, fontSize: 14 }}>
                  {usd(num(b.usd))} • trades {num(b.trades)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};
const modal = {
  background: "#121821",
  color: "#e8eef5",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12,
  width: "min(880px, 90vw)",
  maxHeight: "85vh",
  overflow: "auto",
  padding: 16,
  boxShadow: "0 12px 40px rgba(0,0,0,.45)",
};
const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 };
const xbtn = { background: "transparent", color: "#a8b3c5", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, padding: "6px 10px", cursor: "pointer" };
const chips = { display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 14px" };
const chip  = { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", padding: "6px 10px", borderRadius: 999, fontSize: 13, color: "#c7d2e1" };
const card  = { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", padding: 12, borderRadius: 10 };
const cardTitle = { fontWeight: 600, color: "#c7d2e1", marginBottom: 8 };
const row = { display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px dashed rgba(255,255,255,.06)" };
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" };
