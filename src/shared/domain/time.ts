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
