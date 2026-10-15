/**
 * Money is always stored and computed as integer cents (USD).
 * Conversion to display strings happens only at the edges.
 */
export type Cents = number;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(cents: Cents, options: { decimals?: boolean } = {}): string {
  const { decimals = true } = options;
  return (decimals ? usd : usdWhole).format(cents / 100);
}

export function formatCompactMoney(cents: Cents): string {
  return usdCompact.format(cents / 100);
}

/** Parses a dollar amount (number or user-entered string such as "1,234.50") into integer cents. */
export function dollarsToCents(value: number | string): Cents {
  const text = typeof value === "number" ? String(value) : value.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new RangeError(`Invalid money amount: ${String(value)}`);
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const fractionCents = Math.round(Number(`0.${fraction || "0"}`) * 100);
  const cents = Number(whole) * 100 + fractionCents;
  return negative ? -cents : cents;
}

/** Returns `bps` basis points (1/100 of a percent) of `cents`, rounded half up. */
export function applyBasisPoints(cents: Cents, bps: number): Cents {
  return Math.round((cents * bps) / 10_000);
}
