/** Date helpers shared by domain rules. All calendar math is done in UTC for determinism. */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/** Human relative time for activity feeds: "18 minutes ago", "yesterday", "4 days ago". */
export function formatRelativeTime(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MS_PER_MINUTE) return "just now";
  if (diff < MS_PER_HOUR) return plural(Math.floor(diff / MS_PER_MINUTE), "minute");
  const days = daysBetween(date, now);
  if (days === 0 || diff < 6 * MS_PER_HOUR) return plural(Math.floor(diff / MS_PER_HOUR), "hour");
  if (days === 1) return "yesterday";
  return plural(days, "day");
}

/** First UTC day of the calendar quarter that contains `date`. */
export function startOfQuarter(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1));
}

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Calendar date as shown in tables and registers: "Oct 24, 2024". */
export function formatDate(date: Date): string {
  return longDate.format(date);
}

/** Directory "last activity" cell: "2 hours ago", "Yesterday", "Oct 18" (or "Dec 30, 2025" in other years). */
export function formatLastActivity(date: Date | null, now: Date): string {
  if (!date) return "Never";
  const days = daysBetween(date, now);
  if (days <= 0) return formatRelativeTime(date, now);
  if (days === 1) return "Yesterday";
  return date.getUTCFullYear() === now.getUTCFullYear() ? shortDate.format(date) : longDate.format(date);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a `YYYY-MM-DD` calendar date (form / URL input) as UTC midnight; undefined when malformed or impossible. */
export function parseIsoDate(value: string | undefined): Date | undefined {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : undefined;
}

/** `YYYY-MM-DD` of a UTC date, for date inputs and CSV exports. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
