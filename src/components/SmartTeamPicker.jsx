// src/components/SmartTeamPicker.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";

export default function SmartTeamPicker({
  markets = [],
  value = "",
  onChange,
  onPick,
  placeholder = "Highlight team (e.g., Lakers, Man City)",
  maxSuggestions = 12,
}) {
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const wrapRef = useRef(null);

  const candidates = useMemo(() => {
    const set = new Set();
    const splitter = /(?:(?: vs\.? | v\.? | @ | vs | v | - |—|\u2014|\u2013))/i;
    for (const m of markets) {
      const t = String(m?.title || "").trim();
      if (!t) continue;
      const parts = t.split(splitter).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        for (const p of parts.slice(0, 2)) addCandidate(set, p);
      } else {
        for (const p of liftProperPhrases(t)) addCandidate(set, p);
      }
    }
    return Array.from(set).sort((a, b) => a.length - b.length || a.localeCompare(b));
  }, [markets]);

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return candidates.slice(0, maxSuggestions);
    const qi = q.toLowerCase();
    const scored = [];
    for (const c of candidates) {
      const ci = c.toLowerCase();
      const idx = ci.indexOf(qi);
      if (idx === -1) continue;
      const score = idx * 2 + ci.length;
      scored.push({ c, score });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, maxSuggestions).map(s => s.c);
  }, [value, candidates, maxSuggestions]);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <input
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange?.(e.target.value); if (!open) setOpen(true); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHoverIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHoverIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); const pick = suggestions[Math.max(0, hoverIdx)]; if (pick) { onChange?.(pick); onPick?.(pick); setOpen(false); } }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <div
              key={s + i}
              className={"cursor-pointer px-3 py-2 text-sm " + (i === hoverIdx ? "bg-indigo-50" : "hover:bg-gray-50")}
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => { onChange?.(s); onPick?.(s); setOpen(false); }}
            >
              {highlightMatch(s, value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function addCandidate(set, phrase) {
  const cleaned = phrase.replace(/[\[\]\(\)\{\}\.,!?:;#]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return;
  const words = cleaned.split(" ");
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const chunk = words.slice(i, i + n);
      const txt = chunk.join(" ").trim();
      if (!/[A-Za-z]/.test(txt)) continue;
      if (txt.length < 3) continue;
      const passes =
        /^[A-Z][a-z]/.test(txt) ||
        /^[A-Z]{2,}(?:\s[A-Z]{2,})*$/.test(txt) ||
        /FC$|CF$|SC$|United$|City$|County$|Rovers$|Hotspur$|Lakers$|Warriors$|Celtics$|Knicks$|Giants$|Jets$|Yankees$|Mets$|Dodgers$|Red Sox$/i.test(txt);
      if (passes) set.add(txt);
    }
  }
}

function liftProperPhrases(title) {
  const out = new Set();
  const tokens = title.split(/[^A-Za-z0-9'&]+/).filter(Boolean);
  let buf = [];
  for (const tok of tokens) {
    if (/^[A-Z][a-z0-9'&]*$/.test(tok) || /^[A-Z]{2,}$/.test(tok)) buf.push(tok);
    else { if (buf.length) out.add(buf.join(" ")); buf = []; }
  }
  if (buf.length) out.add(buf.join(" "));
  return Array.from(out);
}

function highlightMatch(text, query) {
  const q = String(query || "").trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (<>{text.slice(0, i)}<strong>{text.slice(i, i + q.length)}</strong>{text.slice(i + q.length)}</>);
}