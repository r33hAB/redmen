// src/components/SourceToggle.jsx
import React from "react";

export default function SourceToggle({ selected = { polymarket: true, kalshi: true }, onChange }) {
  const base = {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #2b3c52",
    background: "transparent",
    color: "#c6cfdb",
    fontSize: 13,
    cursor: "pointer",
  };
  const active = { background: "#1b2738", borderColor: "#3b82f6", color: "#e7effa" };
  const dot = (c) => ({ display:"inline-block", width:10, height:10, borderRadius:9999, background:c, boxShadow:"0 0 0 2px rgba(0,0,0,.25)" });
  return (
    <div style={{ display:"flex", gap:8 }}>
      <button
        onClick={() => onChange?.({ ...selected, polymarket: !selected.polymarket })}
        style={{ ...base, ...(selected.polymarket ? active : {}), display:"inline-flex", alignItems:"center", gap:8 }}
        title="Toggle Polymarket"
      ><span style={dot("#3b82f6")} />Polymarket</button>
      <button
        onClick={() => onChange?.({ ...selected, kalshi: !selected.kalshi })}
        style={{ ...base, ...(selected.kalshi ? active : {}), display:"inline-flex", alignItems:"center", gap:8 }}
        title="Toggle Kalshi"
      ><span style={dot("#f59e0b")} />Kalshi</button>
    </div>
  );
}
