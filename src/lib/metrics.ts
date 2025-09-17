// Shared numeric + display helpers used by List & DetailsModal

export function num(x: any): number {
  if (x == null) return 0;
  const n = +x;
  return Number.isFinite(n) ? n : 0;
}

export function usd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function fmtPct(p: number): string {
  return `${p.toFixed(1)}%`;
}

/**
 * Compute buy/sell/total and percentages defensively.
 * Accepts a market or a { totals: {...} } payload.
 */
export function splitFrom(m: any) {
  const totals = m?.totals || m?.stats || m;

  const buy = num(m?.buyUSD ?? totals?.buyUSD);
  const sell = num(m?.sellUSD ?? totals?.sellUSD);

  // Prefer explicit totalUSD if present; else sum buy+sell
  const total = num(m?.totalUSD ?? totals?.totalUSD);
  const aggTotal = total > 0 ? total : (buy + sell);

  const denom = buy + sell;
  let buyPct = 0;
  let sellPct = 0;
  if (denom > 0) {
    buyPct = (buy / denom) * 100;
    sellPct = 100 - buyPct;
  }

  return { buy, sell, total: aggTotal, buyPct, sellPct };
}
