import React from "react";

function usd(n) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function MarketCard({ mkt, onClick }) {
  const total = mkt.totalUSD || 0;
  const buys = mkt.buys || 0;
  const sells = mkt.sells || 0;
  const sentiment = total > 0 ? (buys - sells) / total : 0;

  return (
    <div className="item" onClick={onClick} role="button">
      <div>
        <div className="market-title">{mkt.title}</div>
        <div className="chips" style={{marginTop: 6}}>
          <span className="badge">Event: {mkt.eventSlug || "—"}</span>
          <span className="badge">Trades: {mkt.tradeCount}</span>
          <span className="badge">Outcomes: {Object.keys(mkt.outcomes || {}).length}</span>
        </div>
        <div className="kv" style={{marginTop: 8}}>
          <div className="small">BUY</div><div className="right small">{usd(buys)}</div>
          <div className="small">SELL</div><div className="right small">{usd(sells)}</div>
          <div className="small">Net Sentiment</div>
          <div className="right small" style={{color: sentiment >= 0 ? "var(--good)" : "var(--bad)"}}>{(sentiment*100).toFixed(1)}%</div>
        </div>
      </div>
      <div className="right">
        <div className="subtitle">Flow (≥$100)</div>
        <div style={{fontWeight:700, fontSize:18}}>{usd(total)}</div>
      </div>
    </div>
  );
}
