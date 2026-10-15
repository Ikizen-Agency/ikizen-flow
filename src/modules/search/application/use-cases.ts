import { emptySearchResults, likePattern, normalizeSearchQuery, SEARCH_GROUP_LIMIT, type SearchResults } from "../domain/search";
import type { SearchRepository } from "./ports";

/** Grouped workspace search (customers, orders, tasks). Queries shorter than 2 characters return no hits. */
export const makeGlobalSearch =
  ({ search }: { search: SearchRepository }) =>
  async (raw: string | null | undefined, limit = SEARCH_GROUP_LIMIT): Promise<SearchResults> => {
    const query = normalizeSearchQuery(raw);
    if (!query) return emptySearchResults(raw?.trim() ?? "");
    const pattern = likePattern(query);
    const [customers, orders, tasks] = await Promise.all([
      search.customers(pattern, limit),
      search.orders(pattern, limit),
      search.tasks(pattern, limit),
    ]);
    return { query, customers, orders, tasks };
  };
