/** Small numeric helpers for KPI tiles. Fractions are plain numbers (0.184 = 18.4%). */

/** Relative change from `previous` to `current`; null when there is no baseline to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** `part / whole`, or 0 when `whole` is 0. */
export function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

export function formatPercent(fraction: number, options: { signed?: boolean } = {}): string {
  const text = `${(fraction * 100).toFixed(1)}%`;
  return options.signed && fraction >= 0 ? `+${text}` : text;
}
