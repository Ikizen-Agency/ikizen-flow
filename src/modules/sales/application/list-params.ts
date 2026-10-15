import { firstParam, parsePage, type SearchParamsRecord } from "../../customers/application/list-params";
import { ORDER_STATUSES, type EffectiveOrderStatus } from "../domain/order";
import type { OrderListQuery } from "./ports";

export const EFFECTIVE_ORDER_STATUSES: ReadonlyArray<EffectiveOrderStatus> = [...ORDER_STATUSES, "overdue"];
export const MAX_ORDER_PAGE_SIZE = 100;

export interface OrderListParamOptions {
  pageSize: number;
  /** Lets callers (the JSON API) choose a page size, clamped to MAX_ORDER_PAGE_SIZE. */
  allowPageSize?: boolean;
}

function positiveInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Translates untrusted URL params into an order list query; invalid values are ignored. */
export function parseOrderListParams(
  params: SearchParamsRecord,
  { pageSize, allowPageSize = false }: OrderListParamOptions,
): Required<Pick<OrderListQuery, "page" | "pageSize">> & Pick<OrderListQuery, "status" | "search" | "customerId"> {
  const status = firstParam(params.status) as EffectiveOrderStatus | undefined;
  const search = firstParam(params.q)?.trim();
  const requested = allowPageSize ? positiveInt(firstParam(params.pageSize)) : undefined;
  return {
    status: status && EFFECTIVE_ORDER_STATUSES.includes(status) ? status : undefined,
    search: search || undefined,
    customerId: positiveInt(firstParam(params.customerId)),
    page: parsePage(firstParam(params.page)),
    pageSize: requested ? Math.min(requested, MAX_ORDER_PAGE_SIZE) : pageSize,
  };
}
