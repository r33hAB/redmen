// BubbleHeatmap.jsx - Final: Contained, No Ghosting, Top 20
import React, { useMemo, useRef } from "react";

export default function BubbleHeatmap({ markets = [], onSelect = () => {} }) {
  const containerRef = useRef(null);
  const positionCacheRef = useRef(new Map());
  
  const prepared = useMemo(() => {
    const sorted = Array.isArray(markets) 
      ? [...markets].sort((a, b) => (b.totalUSD || 0) - (a.totalUSD || 0))
      : [];
    
    const top20 = sorted.slice(0, 20);
    
    if (top20.length === 0) return [];
    
    const vals = top20.map(m => Math.max(1, Number(m.totalUSD || 0)));
    const min = Math.min(...vals, 1);
    const max = Math.max(...vals, 1);
    
    const scale = (v) => {
      const x = Math.log10(Math.max(1, v));
      const a = Math.log10(Math.max(1, min));
      const b = Math.log10(Math.max(1, max));
      return (x - a) / ((b - a) || 1);
    };
    
    return top20.map((m, idx) => {
      const buy = Number(m?.buyUSD || 0);
      const sell = Number(m?.sellUSD || 0);
      const total = buy + sell;
      const pct = total > 0 ? (buy / total) : 0.5;
      const intensity = scale(Number(m.totalUSD || 0));
      
      const marketId = m.conditionId || `market-${idx}`;
      
      let positionData = positionCacheRef.current.get(marketId);
      
      if (!positionData) {
        const hashCode = (str) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return Math.abs(hash);
        };
        
        const hash = hashCode(marketId);
        const size = 80 + intensity * 150;
        
        // Position bubbles so they stay within bounds
        // Account for bubble size when positioning
        const layer = hash % 3;
        const startX = ((hash % 60) + 20); // 20-80% to account for bubble size
        const startY = 15 + layer * 28 + ((hash % 15));
        
        // Smaller wave amplitude to keep bubbles in view
        const waveAmplitude = 15 + ((hash % 15) + intensity * 10);
        const duration = 35 + (hash % 20);
        const delay = -((hash % 25));
        const direction = (hash % 2 === 0) ? 1 : -1;
        
        positionData = {
          _size: size,
          _startX: startX,
          _startY: startY,
          _waveAmp: waveAmplitude,
          _duration: duration,
          _delay: delay,
          _direction: direction,
          _layer: layer,
        };
        
        positionCacheRef.current.set(marketId, positionData);
      } else {
        positionData._size = 80 + intensity * 150;
      }
      
      return {
        ...m,
        _int: intensity,
        _pct: pct,
        _id: marketId,
        ...positionData
      };
    });
  }, [markets]);

  return (
    <div className="bubble-heatmap-final" ref={containerRef}>
      <style>{`
        .bubble-heatmap-final {
          position: relative;
          width: 100%;
          min-height: 700px;
          height: calc(100vh - 400px);
          max-height: 900px;
          overflow: hidden;
          background: 
            radial-gradient(ellipse 1200px 600px at 20% 30%, rgba(59, 130, 246, 0.04), transparent 60%),
            radial-gradient(ellipse 1000px 500px at 80% 70%, rgba(139, 92, 246, 0.04), transparent 60%);
          border-radius: 20px;
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
        }
        
        .floating-bubble-final {
          position: absolute;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 2px solid;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          
          /* GPU acceleration */
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
          
          /* Smooth size changes only */
          transition: 
            width 0.6s ease-out,
            height 0.6s ease-out,
            box-shadow 0.3s ease,
            filter 0.3s ease;
          
          /* Contained animation - shorter travel distance */
          animation: floatContained var(--duration) linear infinite;
          animation-delay: var(--delay);
          
          /* Position relative to percentage */
          left: var(--startX);
          top: var(--startY);
          
          /* Prevent transform from creating new stacking context issues */
          transform-style: preserve-3d;
        }
        
        .floating-bubble-final.layer-0 {
          z-index: 30;
        }
        
        .floating-bubble-final.layer-1 {
          z-index: 20;
          opacity: 0.92;
        }
        
        .floating-bubble-final.layer-2 {
          z-index: 10;
          opacity: 0.85;
        }
        
        /* Fixed hover - no ghosting, scale from center */
        .floating-bubble-final:hover {
          /* Cancel animation transform and apply scale */
          animation-play-state: paused;
          transform: scale(1.25) translateZ(0) !important;
          box-shadow: 0 16px 48px rgba(59, 130, 246, 0.5);
          z-index: 100 !important;
          opacity: 1 !important;
          filter: blur(0px) brightness(1.1);
        }
        
        .bubble-title-final {
          font-size: 12px;
          font-weight: 700;
          color: white;
          line-height: 1.3;
          max-width: 92%;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
          margin-bottom: 10px;
          letter-spacing: -0.3px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        .bubble-amount-final {
          font-size: 15px;
          font-weight: 800;
          color: white;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9);
          letter-spacing: 0.4px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* Contained animation - stays within bounds */
        @keyframes floatContained {
          0% {
            transform: 
              translate3d(0, 0, 0)
              rotate(0deg);
          }
          25% {
            transform: 
              translate3d(
                calc(var(--direction) * 80px), 
                calc(var(--waveAmp) * -0.5px),
                0
              )
              rotate(calc(var(--direction) * 2deg));
          }
          50% {
            transform: 
              translate3d(
                calc(var(--direction) * 160px), 
                0,
                0
              )
              rotate(0deg);
          }
          75% {
            transform: 
              translate3d(
                calc(var(--direction) * 80px), 
                calc(var(--waveAmp) * 0.5px),
                0
              )
              rotate(calc(var(--direction) * -2deg));
          }
          100% {
            transform: 
              translate3d(0, 0, 0)
              rotate(0deg);
          }
        }
        
        .bubble-glow-final {
          position: absolute;
          inset: -12%;
          border-radius: 50%;
          background: radial-gradient(
            circle at center,
            var(--glow-color) 0%,
            transparent 70%
          );
          opacity: 0.3;
          pointer-events: none;
        }
        
        .market-counter {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(15, 20, 32, 0.85);
          backdrop-filter: blur(10px);
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        @media (max-width: 1200px) {
          .bubble-heatmap-final {
            min-height: 600px;
          }
          
          .bubble-title-final {
            font-size: 11px;
          }
          
          .bubble-amount-final {
            font-size: 13px;
          }
        }
        
        @media (max-width: 768px) {
          .bubble-heatmap-final {
            min-height: 500px;
          }
          
          .bubble-title-final {
            font-size: 10px;
            -webkit-line-clamp: 1;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .floating-bubble-final {
            animation: none;
          }
        }
      `}</style>
      
      {prepared.map((m) => {
        const intensity = m._int;
        const buyPct = m._pct;
        
        let bgColor, borderColor, glowColor;
        if (buyPct > 0.6) {
          bgColor = `rgba(16, 185, 129, ${0.25 + intensity * 0.25})`;
          borderColor = `rgba(16, 185, 129, ${0.55 + intensity * 0.35})`;
          glowColor = 'rgba(16, 185, 129, 0.4)';
        } else if (buyPct < 0.4) {
          bgColor = `rgba(239, 68, 68, ${0.25 + intensity * 0.25})`;
          borderColor = `rgba(239, 68, 68, ${0.55 + intensity * 0.35})`;
          glowColor = 'rgba(239, 68, 68, 0.4)';
        } else {
          bgColor = `rgba(59, 130, 246, ${0.25 + intensity * 0.25})`;
          borderColor = `rgba(59, 130, 246, ${0.55 + intensity * 0.35})`;
          glowColor = 'rgba(59, 130, 246, 0.4)';
        }
        
        return (
          <div
            key={m._id}
            className={`floating-bubble-final layer-${m._layer}`}
            onClick={() => onSelect(m.conditionId)}
            style={{
              width: `${m._size}px`,
              height: `${m._size}px`,
              background: bgColor,
              borderColor: borderColor,
              '--duration': `${m._duration}s`,
              '--delay': `${m._delay}s`,
              '--startX': `${m._startX}%`,
              '--startY': `${m._startY}%`,
              '--waveAmp': m._waveAmp,
              '--direction': m._direction,
              '--glow-color': glowColor,
            }}
          >
            <div className="bubble-glow-final" />
            <div className="bubble-title-final">
              {m.title}
            </div>
            <div className="bubble-amount-final">
              ${(m.totalUSD >= 1000 
                ? `${(m.totalUSD / 1000).toFixed(1)}k` 
                : Math.round(m.totalUSD))}
            </div>
          </div>
        );
      })}
      
      <div className="market-counter">
        Top {prepared.length} Markets
      </div>
    </div>
  );
}
