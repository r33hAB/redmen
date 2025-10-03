import React, { useEffect, useState } from "react";

export default function Toaster({ alerts = [], onDismiss }) {
  // auto-dismiss after 8s
  useEffect(() => {
    const timers = alerts.map(a => setTimeout(() => onDismiss?.(a.id), 8000));
    return () => timers.forEach(clearTimeout);
  }, [alerts, onDismiss]);

  return (
    <div style={{ position:"fixed", right: 16, bottom: 16, zIndex: 4000, display:"flex", flexDirection:"column", gap:8 }}>
      {alerts.slice(-4).map(a => (
        <div key={a.id} style={{
          background: "rgba(15,24,35,.95)",
          border: "1px solid #2b3c52",
          borderRadius: 10,
          padding: "10px 12px",
          minWidth: 280,
          boxShadow: "0 4px 20px rgba(0,0,0,.35)",
          color: "#e6edf5"
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
          <div style={{ fontSize: 12, color: "#b9c6d8" }}>{a.body}</div>
        </div>
      ))}
    </div>
  );
}