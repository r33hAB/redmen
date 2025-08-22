import React from "react";

export default function DebugPanel({ open, logs, onClear }) {
  if (!open) return null;
  return (
    <div className="panel debug" style={{marginTop: 12}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <b>Debug</b>
        <button onClick={onClear}>Clear</button>
      </div>
      <div className="hr" />
      <div>
        {logs.length === 0 ? <div className="small">No logs</div> : logs.map((l, i) => (
          <details key={i} open style={{marginBottom: 8}}>
            <summary>{l.label}</summary>
            <div className="small">{l.when}</div>
            {l.url && <div className="small">URL: <a href={l.url} target="_blank" rel="noreferrer">{l.url}</a></div>}
            {l.error && <pre className="debug">ERROR: {String(l.error)}</pre>}
            {l.data && <pre className="debug">{JSON.stringify(l.data, null, 2)}</pre>}
          </details>
        ))}
      </div>
    </div>
  );
}
