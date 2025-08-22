import React from "react";

function usd(n) {
  return Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function DetailsModal({ market, priceInfo, onClose }) {
  if (!market) return null;

  return (
    <div className="rm-modal">
      <div className="rm-modal__backdrop" onClick={onClose} />
      <div className="rm-modal__card">
        <div className="rm-modal__header">
          <h3>{market.title}</h3>
          <button className="primary" onClick={onClose}>Close</button>
        </div>

        <div className="chips">
          <span className="badge">Event: {market.eventSlug}</span>
          <span className="badge">Trades: {market.tradeCount}</span>
          <span className="badge">Flow: {usd(market.totalUSD)}</span>
          {priceInfo?.token && <span className="badge">Token: {priceInfo.token.slice(0, 10)}…</span>}
        </div>

        <div className="grid" style={{ marginTop: 8, gridTemplateColumns: "1fr 1fr" }}>
          <div className="panel">
            <b>Outcome Breakdown</b>
            <div className="kv" style={{ marginTop: 8 }}>
              {Object.entries(market.outcomes).map(([k, v]) => (
                <React.Fragment key={k}>
                  <div>{k}</div>
                  <div className="right">{usd(v.usd)} <span className="small">({v.count} trades)</span></div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="panel">
            <b>Top Bettors (by flow)</b>
            <div className="list" style={{ marginTop: 8 }}>
              {(market.topBettors || []).map((b) => (
                <div className="item" key={b.id}>
                  <div className="market-title">{b.id}</div>
                  <div className="right subtitle">{usd((b.buys || 0) + (b.sells || 0))}</div>
                </div>
              ))}
              {(!market.topBettors || market.topBettors.length === 0) && (
                <div className="subtitle">No bettor summary available for this lookback.</div>
              )}
            </div>
          </div>

          <div className="panel" style={{ gridColumn: "1 / -1" }}>
            <b>Last 100 Trades</b>
            <div className="kv" style={{ marginTop: 8 }}>
              {(market.trades || []).slice(0, 100).map((t, i) => (
                <React.Fragment key={i}>
                  <div className="subtitle">{t.side} • {t.name || t.pseudonym || t.proxyWallet || "Anon"}</div>
                  <div className="right">{usd(t.size)}</div>
                </React.Fragment>
              ))}
              {(!market.trades || market.trades.length === 0) && (
                <div className="subtitle">No trades in this period.</div>
              )}
            </div>
          </div>

          {priceInfo && (
            <div className="panel" style={{ gridColumn: "1 / -1" }}>
              <b>Price Info</b>
              <div className="kv" style={{ marginTop: 8 }}>
                <div className="small">Token</div>
                <div className="right small">{priceInfo.token}</div>
                <div className="small">Endpoint</div>
                <div className="right small"><a target="_blank" href={priceInfo.url}>prices-history</a></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}