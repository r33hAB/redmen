// src/components/SmartTeamPicker.jsx
import React, { useMemo, useState } from "react";
import { collectTeamsFromMarkets } from "../lib/teamDetect.js";

export default function SmartTeamPicker({
  markets = [],
  value = "",
  onChange,
  onlySelected = true,
  onOnlyChange,
}) {
  const [query, setQuery] = useState("");

  const teams = useMemo(() => collectTeamsFromMarkets(markets), [markets]);
  const topTeams = teams.slice(0, 24);
  const filtered = (query || "").trim()
    ? teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : topTeams;

  const handlePick = (name) => {
    onChange?.(name);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Team filter (auto-detected)"
          className="px-3 py-2 rounded-lg border border-black/20 bg-[#0f1520] text-[#e6edf5] min-w-[220px]"
          list="teams-datalist"
        />
        <datalist id="teams-datalist">
          {teams.map((t) => (
            <option key={t.name} value={t.name} />
          ))}
        </datalist>

        <label className="inline-flex items-center gap-2 text-sm text-[#9fb0c7]">
          <input
            type="checkbox"
            checked={onlySelected}
            onChange={(e) => onOnlyChange?.(e.target.checked)}
          />
          Only show this team
        </label>

        {value && (
          <button
            type="button"
            onClick={() => onChange?.("")}
            className="px-2 py-1 rounded-lg border border-black/20 text-sm opacity-80 hover:opacity-100"
            title="Clear team filter"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {filtered.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => handlePick(t.name)}
            className={[
              "px-2 py-1 rounded-full border text-sm",
              value === t.name
                ? "border-black/60 font-semibold"
                : "border-black/10 opacity-80 hover:opacity-100",
            ].join(" ")}
            title={`${t.count} market${t.count !== 1 ? "s" : ""} mentioning ${t.name}`}
          >
            {t.name}
            <span className="opacity-60"> · {t.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
