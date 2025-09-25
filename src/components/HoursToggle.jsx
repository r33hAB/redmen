import React from "react";

const HOURS_OPTS = [1, 6, 12, 24];

export default function HoursToggle({ value = 24, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm opacity-70">Window:</span>
      {HOURS_OPTS.map((h) => (
        <button
          key={h}
          onClick={() => onChange?.(h)}
          className={[
            "px-2 py-1 rounded-lg border text-sm",
            value === h ? "border-black/60 font-semibold" : "border-black/10 opacity-80 hover:opacity-100"
          ].join(" ")}
          type="button"
          aria-pressed={value === h}
          title={`${h}h window`}
        >
          {h}h
        </button>
      ))}
    </div>
  );
}