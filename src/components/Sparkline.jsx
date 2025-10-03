import React from "react";

export default function Sparkline({ points = [], width = 240, height = 60, strokeWidth = 2, markers = [] }) {
  if (!Array.isArray(points) || points.length < 2) {
    return <svg width={width} height={height} />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  const path = points.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg width={width} height={height}>
      <path d={path} fill="none" stroke="#93c5fd" strokeWidth={strokeWidth} />
      {markers.map((m, idx) => {
        const { index } = m;
        if (index == null || index < 0 || index >= points.length) return null;
        const x = index * stepX;
        const v = points[index];
        const y = height - ((v - min) / span) * (height - 4) - 2;
        return <circle key={idx} cx={x} cy={y} r="3" fill="#f59e0b" />;
      })}
    </svg>
  );
}