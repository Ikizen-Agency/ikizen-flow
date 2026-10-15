export type PaginationItem = number | "gap";

/** Page numbers to render: first, last, and a window around the current page, with gaps in between. */
export function paginationRange(current: number, totalPages: number, siblings = 1): PaginationItem[] {
  if (totalPages <= 1) return [1];
  const pages = new Set<number>([1, totalPages]);
  const start = Math.max(1, Math.min(current - siblings, totalPages - 2 * siblings));
  const end = Math.min(totalPages, Math.max(current + siblings, 2 * siblings + 1));
  for (let p = start; p <= end; p++) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1]! > 1) items.push("gap");
    items.push(page);
  });
  return items;
}
