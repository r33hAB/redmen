// Flow bucketing utilities for 1h windows

// Minute bins of total flow (sizeUSD/size) for 60 minutes
export function minuteBins1h(trades = []) {
  const bins = new Array(60).fill(0);
  const now = Date.now() / 1000;
  const start = now - 3600;
  for (const t of (Array.isArray(trades) ? trades : [])) {
    const ts = Number(t?.ts ?? t?.timestamp ?? t?.time ?? 0);
    if (!ts || ts < start || ts > now) continue;
    const idx = Math.min(59, Math.max(0, Math.floor((ts - start) / 60)));
    const usd = Math.abs(Number(t?.usd ?? t?.totalUSD ?? t?.flowUSD ?? t?.amountUSD ?? t?.sizeUSD ?? t?.size ?? 0) || 0);
    bins[idx] += usd;
  }
  return bins;
}

// Z-score of sum(last 5 bins) vs previous 30-bin baseline
export function zscore5v30(bins = []) {
  if (!bins || bins.length < 36) return { z: 0, last5: 0, mean: 0, std: 0 };
  const last5 = bins.slice(-5).reduce((a,b)=>a+b,0);
  const base = bins.slice(-35, -5);
  const mean = base.reduce((a,b)=>a+b,0) / base.length;
  const variance = base.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / base.length;
  const std = Math.sqrt(variance);
  const z = std > 0 ? (last5 - mean) / std : 0;
  return { z, last5, mean, std };
}

// Flow by outcome label, 5-min buckets across the last hour.
// Returns: { labels: string[], series: Array<{ label, bins: number[] }> }
// We count absolute flow per outcome (direction-agnostic), so it works for multi-outcome markets.
export function bucketTrades1hByOutcome(trades = [], maxLabels = 2) {
  const now = Date.now() / 1000;
  const start = now - 3600;
  const binsPerHour = 12;
  const minutesPerBin = 60 / binsPerHour;

  // Map outcome label -> [12] bins
  const map = new Map();

  for (const t of (Array.isArray(trades) ? trades : [])) {
    const ts = Number(t?.ts ?? t?.timestamp ?? t?.time ?? 0);
    if (!ts || ts < start || ts > now) continue;
    const labelRaw = t?.outcome ?? t?.answer ?? t?.selection ?? t?.sideLabel ?? "";
    const label = String(labelRaw || "").trim() || "Unknown";
    const usd = Math.abs(Number(t?.usd ?? t?.totalUSD ?? t?.flowUSD ?? t?.amountUSD ?? t?.sizeUSD ?? t?.size ?? 0) || 0);
    const minuteIndex = Math.min(59, Math.max(0, Math.floor((ts - start) / 60)));
    const binIndex = Math.floor(minuteIndex / minutesPerBin);

    if (!map.has(label)) map.set(label, new Array(binsPerHour).fill(0));
    const bins = map.get(label);
    bins[binIndex] += usd;
  }

  // Choose top outcome labels by total
  const totals = Array.from(map, ([label, bins]) => ({
    label,
    total: bins.reduce((a,b)=>a+b,0),
    bins
  })).sort((a,b)=>b.total-a.total);

  const top = totals.slice(0, Math.max(1, maxLabels));
  return {
    labels: top.map(x => x.label),
    series: top.map(x => ({ label: x.label, bins: x.bins }))
  };
}
