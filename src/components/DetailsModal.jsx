import React from "react";

export default function DetailsModal({ market, priceInfo, onClose }) {
  function usd(n) {
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

  const buy = Math.max(0, Number(market?.buys) || 0);
  const sell = Math.max(0, Number(market?.sells) || 0);
  const tot = Math.max(1, buy + sell);
  const buyPct = Math.round((buy / tot) * 100);
  const sellPct = 100 - buyPct;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: "8px 0" }}>{market.title}</h3>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="chips" style={{ marginTop: 6 }}>
          <span className="badge">Event: {market.eventSlug}</span>
          <span className="badge">Trades: {market.tradeCount}</span>
          <span className="badge">Flow: {usd(market.totalUSD)}</span>
          {priceInfo?.token && <span className="badge">Token: {String(priceInfo.token).slice(0, 10)}…</span>}
        </div>

        {/* Participation */}
        <div className="chips" style={{ marginTop: 6 }}>
          <span className="badge">Unique buyers: {market.uniqueBuyers ?? 0}</span>
          <span className="badge">Unique sellers: {market.uniqueSellers ?? 0}</span>
          <span className="badge">Split: {buyPct}% / {sellPct}%</span>
        </div>

        <div className="grid" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr" }}>
          <div className="panel">
            <b>Outcome Breakdown</b>
            <div className="kv" style={{ marginTop: 8 }}>
              {Object.entries(market.outcomes || {}).map(([k, v]) => (
                <React.Fragment key={k}>
                  <div>{k}</div>
                  <div className="right">
                    {usd(v.usd)} <span className="small">({v.count} trades)</span>
                  </div>
                </React.Fragment>
              ))}
              {Object.keys(market.outcomes || {}).length === 0 && (
                <div className="small">No outcome data available for this lookback.</div>
              )}
            </div>
          </div>

          <div className="panel">
            <b>Price (last 24h)</b>
            {priceInfo?.error && (
              <div className="small" style={{ color: "var(--bad)" }}>
                Failed: {priceInfo.error}
              </div>
            )}
            {!priceInfo && <div className="small">Loading…</div>}
            {priceInfo && (priceInfo.last || priceInfo.first) && (
              <div className="kv" style={{ marginTop: 8 }}>
                <div>First</div>
                <div className="right">{priceInfo.first?.toFixed(3) ?? "—"}</div>
                <div>Last</div>
                <div className="right">{priceInfo.last?.toFixed(3) ?? "—"}</div>
                <div>Δ</div>
                <div
                  className="right"
                  style={{ color: (priceInfo.last - priceInfo.first) >= 0 ? "var(--good)" : "var(--bad)" }}
                >
                  {((priceInfo.last - priceInfo.first) * 100).toFixed(1)}%
                </div>
                <div className="small">Endpoint</div>
                <div className="right small">
                  <a target="_blank" rel="noreferrer" href={priceInfo.url}>prices-history</a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top bettors for this market (if you want to surface them) */}
        {Array.isArray(market.topBettors) && market.topBettors.length > 0 && (
          <div className="panel" style={{ marginTop: 12 }}>
            <b>Top Bettors (by flow)</b>
            <div className="list" style={{ marginTop: 8 }}>
              {market.topBettors.slice(0, 8).map((u) => {
                const total = (u.buys || 0) + (u.sells || 0);
                const bias = total > 0 ? (u.buys - u.sells) / total : 0;
                return (
                  <div className="item" key={u.id}>
                    <div>
                      <div className="market-title">{u.id}</div>
                      <div className="chips" style={{ marginTop: 6 }}>
                        <span className="badge">{usd(total)} total</span>
                        <span className="badge">Trades: {u.trades}</span>
                      </div>
                    </div>
                    <div className="right small" style={{ color: bias >= 0 ? "var(--good)" : "var(--bad)" }}>
                      {(bias * 100).toFixed(1)}% net buy bias
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
