export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;
export const SEARCH_GROUP_LIMIT = 5;

/** Trimmed, whitespace-collapsed query, or null when it is too short to search. */
export function normalizeSearchQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
  return q.length >= SEARCH_MIN_LENGTH ? q : null;
}

/** `%q%` LIKE pattern with `%`, `_` and the escape character escaped (use with `ESCAPE '\'`). */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export interface CustomerHit {
  id: number;
  company: string;
  contactName: string;
}

export interface OrderHit {
  reference: string;
  title: string;
  invoiceNumber: string | null;
  customerCompany: string;
}

export interface TaskHit {
  id: number;
  code: string;
  title: string;
}

export interface SearchResults {
  query: string;
  customers: CustomerHit[];
  orders: OrderHit[];
  tasks: TaskHit[];
}

export const customerHref = (hit: Pick<CustomerHit, "id">) => `/customers?customer=${hit.id}`;
export const orderHref = (hit: Pick<OrderHit, "reference">) => `/sales?order=${encodeURIComponent(hit.reference)}`;
export const taskHref = (hit: Pick<TaskHit, "id">) => `/tasks?task=${hit.id}`;

export const emptySearchResults = (query: string): SearchResults => ({ query, customers: [], orders: [], tasks: [] });
