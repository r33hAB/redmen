// src/lib/metrics.ts
// Shared numeric + display helpers used by List, Cards & DetailsModal

export function num(x: any): number {
  if (x == null) return 0;
  const n = +x;
  return Number.isFinite(n) ? n : 0;
}

export function usd(n: number): string {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function fmtPct(p: number): string {
  return `${(Number(p) || 0).toFixed(1)}%`;
}

/**
 * Normalizes a market-like object into buy/sell/total and percentages.
 * Accepts either top-level totals (totalUSD, buyUSD, sellUSD) or nested totals.
 */
export function splitFrom(m: any): { buy: number; sell: number; total: number; buyPct: number; sellPct: number } {
  // prefer nested totals if present
  const totals = m?.totals || m?.stats || {};
  const buy  = num(m?.buyUSD  ?? totals?.buyUSD);
  const sell = num(m?.sellUSD ?? totals?.sellUSD);

  // total can be explicitly provided; otherwise compute
  const totalField = num(m?.totalUSD ?? totals?.totalUSD);
  const total = totalField > 0 ? totalField : (buy + sell);

  const denom = buy + sell;
  const buyPct  = denom > 0 ? (buy  / denom) * 100 : 50;
  const sellPct = denom > 0 ? 100 - buyPct         : 50;

  return { buy, sell, total, buyPct, sellPct };
}
