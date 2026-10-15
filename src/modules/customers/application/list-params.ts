import { CUSTOMER_STATUSES, CUSTOMER_TIERS, type CustomerStatus, type CustomerTier } from "../domain/customer";
import type { CustomerListQuery, CustomerSort } from "./ports";

export const CUSTOMER_SORTS: ReadonlyArray<CustomerSort> = ["last_active", "sales_desc", "sales_asc", "company"];
export const CUSTOMER_PAGE_SIZE = 6;

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(allowed: ReadonlyArray<T>, value: string | undefined): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Translates untrusted URL search params into a safe directory query (unknown values are ignored). */
export function parseCustomerListParams(params: SearchParamsRecord): Required<Omit<CustomerListQuery, "search" | "status" | "tier">> &
  Pick<CustomerListQuery, "search" | "status" | "tier"> {
  const search = firstParam(params.q)?.trim();
  return {
    search: search || undefined,
    status: oneOf<CustomerStatus>(CUSTOMER_STATUSES, firstParam(params.status)),
    tier: oneOf<CustomerTier>(CUSTOMER_TIERS, firstParam(params.tier)),
    sort: oneOf(CUSTOMER_SORTS, firstParam(params.sort)) ?? "last_active",
    page: parsePage(firstParam(params.page)),
    pageSize: CUSTOMER_PAGE_SIZE,
  };
}
