// BubbleBoard.jsx - With Volume Sorting (High to Low)
import React, { useMemo } from "react";

export default function BubbleBoard({ markets = [], onSelect = () => {}, watchlist = new Set(), onToggleWatch = () => {} }) {
  
  const getKalshiEventKey = (market) => {
    const slug = String(market?.slug || market?.conditionId || "");
    const parts = slug.split("-");
    if (parts.length >= 2) {
      return parts.slice(0, -1).join("-");
    }
    return slug;
  };
  
  const prepared = useMemo(() => {
    const arr = Array.isArray(markets) ? markets : [];
    
    // Group Kalshi markets by event, keep Polymarket as-is
    const kalshiGroups = new Map();
    const polymarkets = [];
    
    for (const m of arr) {
      const source = String(m?.source || "").toLowerCase();
      
      if (source === "kalshi") {
        const eventKey = getKalshiEventKey(m);
        if (!kalshiGroups.has(eventKey)) {
          kalshiGroups.set(eventKey, []);
        }
        kalshiGroups.get(eventKey).push(m);
      } else {
        polymarkets.push(m);
      }
    }
    
    // Process Kalshi groups
    const mergedKalshi = Array.from(kalshiGroups.entries()).map(([eventKey, markets]) => {
      if (markets.length === 2) {
        const [m1, m2] = markets;
        const total1 = Number(m1?.totalUSD || (Number(m1?.buyUSD||0) + Number(m1?.sellUSD||0)) || 0);
        const total2 = Number(m2?.totalUSD || (Number(m2?.buyUSD||0) + Number(m2?.sellUSD||0)) || 0);
        
        const primary = total1 >= total2 ? m1 : m2;
        const secondary = total1 >= total2 ? m2 : m1;
        
        const slug1 = String(m1.slug || "").split("-").pop().toUpperCase();
        const slug2 = String(m2.slug || "").split("-").pop().toUpperCase();
        
        const trades1 = Number(m1?.trades || 0);
        const trades2 = Number(m2?.trades || 0);
        
        return {
          ...primary,
          _isPaired: true,
          _side1: { name: slug1, ...m1, total: total1, trades: trades1 },
          _side2: { name: slug2, ...m2, total: total2, trades: trades2 },
          _combinedTotal: total1 + total2,
          _combinedTrades: trades1 + trades2,
        };
      } else {
        const m = markets[0];
        return {
          ...m,
          _isPaired: false,
        };
      }
    });
    
    // Combine and filter
    const combined = [...polymarkets, ...mergedKalshi].filter(m => {
      // Filter out markets with < 2 trades
      if (m._isPaired) {
        return m._combinedTrades >= 2;
      } else {
        return Number(m?.trades || 0) >= 2;
      }
    });
    
    // Calculate scaling
    const allTotals = combined.map(m => {
      if (m._isPaired) return m._combinedTotal;
      return Number(m?.totalUSD || (Number(m?.buyUSD||0)+Number(m?.sellUSD||0)) || 0);
    });
    const gmin = Math.min(...allTotals, 0);
    const gmax = Math.max(...allTotals, 1);
    
    const processed = combined.map((m, idx) => {
      const source = String(m?.source || "").toLowerCase();
      
      if (source === "kalshi" && m._isPaired) {
        const total = m._combinedTotal;
        const side1Total = m._side1.total;
        const side2Total = m._side2.total;
        const side1Pct = side1Total / Math.max(1, total);
        
        const tRaw = (total - gmin) / ((gmax - gmin) || 1);
        const s = Math.sqrt(Math.max(0, Math.min(1, tRaw)));
        const d = Math.round(56 + s * (140 - 56));
        
        return {
          ...m,
          _total: total,
          _side1Pct: side1Pct,
          _side2Pct: 1 - side1Pct,
          _d: d,
          _trades: m._combinedTrades,
          _source: source,
          _id: m.conditionId || `kalshi-paired-${idx}`,
        };
      } else {
        const buy = Number(m?.buyUSD || 0);
        const sell = Number(m?.sellUSD || 0);
        const total = Number(m?.totalUSD || (buy + sell) || 0);
        const buyPct = buy / Math.max(1, buy + sell);
        
        const tRaw = (total - gmin) / ((gmax - gmin) || 1);
        const s = Math.sqrt(Math.max(0, Math.min(1, tRaw)));
        const d = Math.round(56 + s * (140 - 56));
        
        return {
          ...m,
          _total: total,
          _buyPct: buyPct,
          _buy: buy,
          _sell: sell,
          _d: d,
          _trades: Number(m?.trades||0),
          _source: source,
          _id: m.conditionId || m.slug || `market-${idx}`,
        };
      }
    });
    
    // Sort by total volume descending (highest first)
    return processed.sort((a, b) => b._total - a._total);
    
  }, [markets]);

  return (
    <div className="bubble-board-final">
      <style>{`
        .bubble-board-final {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 18px;
          padding: 20px 0;
        }
        
        .bubble-card-final {
          background: linear-gradient(145deg, 
            rgba(21, 27, 43, 0.95), 
            rgba(15, 20, 32, 0.95));
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 14px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }
        
        .bubble-card-final.source-polymarket {
          border-left: 3px solid #8b5cf6;
        }
        
        .bubble-card-final.source-kalshi {
          border-left: 3px solid #f59e0b;
        }
        
        .bubble-card-final:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
          border-color: rgba(148, 163, 184, 0.3);
        }
        
        .card-header-final {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        
        .source-badge-final {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        
        .source-badge-final.polymarket {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
        
        .source-badge-final.kalshi {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        
        .source-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .source-dot.polymarket {
          background: #8b5cf6;
        }
        
        .source-dot.kalshi {
          background: #f59e0b;
        }
        
        .watch-btn {
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: rgba(148, 163, 184, 0.5);
          padding: 4px 7px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        
        .watch-btn:hover {
          border-color: #fbbf24;
          color: #fbbf24;
        }
        
        .watch-btn.watched {
          border-color: #fbbf24;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.1);
        }
        
        .card-title-final {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          color: #f8fafc;
          margin-bottom: 16px;
          min-height: 40px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .gauge-wrapper-final {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 16px;
          position: relative;
        }
        
        .gauge-svg-final {
          width: 120px;
          height: 120px;
          transform: rotate(-90deg);
        }
        
        .gauge-content-final {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        
        .gauge-percent-final {
          font-size: 28px;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        }
        
        .gauge-sublabel-final {
          font-size: 10px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
        
        .kalshi-labels {
          display: flex;
          justify-content: space-around;
          margin-top: 8px;
          gap: 8px;
        }
        
        .kalshi-label-item {
          text-align: center;
          flex: 1;
        }
        
        .kalshi-label-name {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
          margin-bottom: 2px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .kalshi-label-volume {
          font-size: 10px;
          color: #94a3b8;
        }
        
        .stats-grid-final {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding-top: 14px;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .stat-item-final {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        
        .stat-label-final {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }
        
        .stat-value-final {
          font-size: 14px;
          color: #f8fafc;
          font-weight: 700;
        }
        
        .flow-bars-final {
          grid-column: 1 / -1;
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 8px 0;
          margin-top: 4px;
        }
        
        .flow-bar-container-final {
          flex: 1;
          height: 6px;
          background: rgba(148, 163, 184, 0.15);
          border-radius: 3px;
          overflow: hidden;
          position: relative;
        }
        
        .flow-bar-buy-final {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: #10b981;
          transition: width 0.5s ease;
        }
        
        .flow-bar-sell-final {
          position: absolute;
          right: 0;
          top: 0;
          height: 100%;
          background: #ef4444;
          transition: width 0.5s ease;
        }
        
        .flow-legend-final {
          display: flex;
          gap: 12px;
          font-size: 10px;
          font-weight: 600;
        }
        
        .flow-legend-item-final {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .flow-dot-final {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .flow-dot-final.buy {
          background: #10b981;
        }
        
        .flow-dot-final.sell {
          background: #ef4444;
        }
        
        @media (max-width: 768px) {
          .bubble-board-final {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      
      {prepared.map((m) => {
        const isWatched = watchlist.has(m.conditionId);
        const isPaired = m._source === 'kalshi' && m._isPaired;
        
        if (isPaired) {
          const side1Pct = m._side1Pct;
          
          let gaugeColor, gaugeBg;
          if (side1Pct >= 0.7) {
            gaugeColor = '#10b981';
            gaugeBg = 'rgba(16, 185, 129, 0.15)';
          } else if (side1Pct >= 0.55) {
            gaugeColor = '#22c55e';
            gaugeBg = 'rgba(34, 197, 94, 0.15)';
          } else if (side1Pct >= 0.45) {
            gaugeColor = '#3b82f6';
            gaugeBg = 'rgba(59, 130, 246, 0.15)';
          } else if (side1Pct >= 0.3) {
            gaugeColor = '#f97316';
            gaugeBg = 'rgba(249, 115, 22, 0.15)';
          } else {
            gaugeColor = '#ef4444';
            gaugeBg = 'rgba(239, 68, 68, 0.15)';
          }
          
          const circumference = 2 * Math.PI * 50;
          const offset = circumference - (side1Pct * circumference);
          
          return (
            <div
              key={m._id}
              className={`bubble-card-final source-${m._source}`}
              onClick={() => onSelect(m.conditionId)}
            >
              <div className="card-header-final">
                <div className={`source-badge-final ${m._source}`}>
                  <div className={`source-dot ${m._source}`}></div>
                  Kalshi
                </div>
                <button
                  className={`watch-btn ${isWatched ? 'watched' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatch(m.conditionId);
                  }}
                >
                  {isWatched ? '★' : '☆'}
                </button>
              </div>
              
              <div className="card-title-final">
                {m.title}
              </div>
              
              <div className="gauge-wrapper-final">
                <svg className="gauge-svg-final">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={gaugeBg}
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="gauge-content-final">
                  <div className="gauge-percent-final">
                    {Math.round(side1Pct * 100)}%
                  </div>
                  <div className="gauge-sublabel-final">
                    {m._side1.name}
                  </div>
                </div>
              </div>
              
              <div className="kalshi-labels">
                <div className="kalshi-label-item">
                  <div className="kalshi-label-name">{m._side1.name}</div>
                  <div className="kalshi-label-volume">
                    ${m._side1.total >= 1000 
                      ? `${(m._side1.total / 1000).toFixed(1)}k` 
                      : Math.round(m._side1.total)}
                  </div>
                </div>
                <div className="kalshi-label-item">
                  <div className="kalshi-label-name">{m._side2.name}</div>
                  <div className="kalshi-label-volume">
                    ${m._side2.total >= 1000 
                      ? `${(m._side2.total / 1000).toFixed(1)}k` 
                      : Math.round(m._side2.total)}
                  </div>
                </div>
              </div>
              
              <div className="stats-grid-final">
                <div className="stat-item-final">
                  <span className="stat-label-final">Total Volume</span>
                  <span className="stat-value-final">
                    ${m._total >= 1000 
                      ? `${(m._total / 1000).toFixed(1)}k` 
                      : Math.round(m._total)}
                  </span>
                </div>
                <div className="stat-item-final">
                  <span className="stat-label-final">Total Trades</span>
                  <span className="stat-value-final">{m._trades}</span>
                </div>
              </div>
            </div>
          );
        } else {
          const buyPct = m._buyPct;
          const sellPct = 1 - buyPct;
          
          let gaugeColor, gaugeBg;
          if (buyPct >= 0.7) {
            gaugeColor = '#10b981';
            gaugeBg = 'rgba(16, 185, 129, 0.15)';
          } else if (buyPct >= 0.55) {
            gaugeColor = '#22c55e';
            gaugeBg = 'rgba(34, 197, 94, 0.15)';
          } else if (buyPct >= 0.45) {
            gaugeColor = '#3b82f6';
            gaugeBg = 'rgba(59, 130, 246, 0.15)';
          } else if (buyPct >= 0.3) {
            gaugeColor = '#f97316';
            gaugeBg = 'rgba(249, 115, 22, 0.15)';
          } else {
            gaugeColor = '#ef4444';
            gaugeBg = 'rgba(239, 68, 68, 0.15)';
          }
          
          const circumference = 2 * Math.PI * 50;
          const offset = circumference - (buyPct * circumference);
          
          return (
            <div
              key={m._id}
              className={`bubble-card-final source-${m._source}`}
              onClick={() => onSelect(m.conditionId)}
            >
              <div className="card-header-final">
                <div className={`source-badge-final ${m._source}`}>
                  <div className={`source-dot ${m._source}`}></div>
                  {m._source === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                </div>
                <button
                  className={`watch-btn ${isWatched ? 'watched' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatch(m.conditionId);
                  }}
                >
                  {isWatched ? '★' : '☆'}
                </button>
              </div>
              
              <div className="card-title-final">
                {m.title}
              </div>
              
              <div className="gauge-wrapper-final">
                <svg className="gauge-svg-final">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={gaugeBg}
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="gauge-content-final">
                  <div className="gauge-percent-final">
                    {Math.round(buyPct * 100)}%
                  </div>
                  <div className="gauge-sublabel-final">
                    Buy Side
                  </div>
                </div>
              </div>
              
              <div className="stats-grid-final">
                <div className="stat-item-final">
                  <span className="stat-label-final">Volume</span>
                  <span className="stat-value-final">
                    ${m._total >= 1000 
                      ? `${(m._total / 1000).toFixed(1)}k` 
                      : Math.round(m._total)}
                  </span>
                </div>
                <div className="stat-item-final">
                  <span className="stat-label-final">Trades</span>
                  <span className="stat-value-final">{m._trades}</span>
                </div>
                
                <div className="flow-bars-final">
                  <div className="flow-bar-container-final">
                    <div className="flow-bar-buy-final" style={{ width: `${buyPct * 100}%` }}></div>
                    <div className="flow-bar-sell-final" style={{ width: `${sellPct * 100}%` }}></div>
                  </div>
                </div>
                
                <div className="flow-legend-final" style={{ gridColumn: '1 / -1' }}>
                  <div className="flow-legend-item-final">
                    <div className="flow-dot-final buy"></div>
                    <span style={{ color: '#10b981' }}>
                      Buy ${m._buy >= 1000 ? `${(m._buy / 1000).toFixed(1)}k` : Math.round(m._buy)}
                    </span>
                  </div>
                  <div className="flow-legend-item-final">
                    <div className="flow-dot-final sell"></div>
                    <span style={{ color: '#ef4444' }}>
                      Sell ${m._sell >= 1000 ? `${(m._sell / 1000).toFixed(1)}k` : Math.round(m._sell)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
