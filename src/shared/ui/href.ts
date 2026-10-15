export type QueryValue = string | number | null | undefined;

/** Builds `path?query` from the current params plus updates; null/undefined/empty values are dropped. */
export function hrefWith(
  path: string,
  current: Record<string, QueryValue>,
  updates: Record<string, QueryValue> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...updates })) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
