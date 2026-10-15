import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { ORDER_CATEGORIES, type OrderCategory } from "../../sales/domain/order";
import { DASHBOARD_PERIODS, type DashboardPeriod, type TrendMetric } from "../domain/dashboard";
import type { DashboardFilters, DashboardQuery } from "./use-cases";

const positiveId = (value: string | undefined) => (value && /^\d{1,9}$/.test(value) && Number(value) > 0 ? Number(value) : undefined);

/**
 * URL state of the overview: `?period=month|quarter|year`, `?metric=gross|collected` and the Filters popover
 * (`?category=<order category>`, `?customer=<id>`, `?assignee=<member id>`).
 */
export function parseDashboardParams(params: SearchParamsRecord): DashboardQuery {
  const period = firstParam(params.period);
  const metric: TrendMetric = firstParam(params.metric) === "collected" ? "collected" : "gross";
  const category = firstParam(params.category);
  const filters: DashboardFilters = {};
  if (ORDER_CATEGORIES.includes(category as OrderCategory)) filters.category = category as OrderCategory;
  const customerId = positiveId(firstParam(params.customer));
  if (customerId) filters.customerId = customerId;
  const assigneeId = positiveId(firstParam(params.assignee));
  if (assigneeId) filters.assigneeId = assigneeId;
  return {
    period: DASHBOARD_PERIODS.includes(period as DashboardPeriod) ? (period as DashboardPeriod) : "month",
    metric,
    filters,
  };
}

/** Filters as URL params (for links that keep them). */
export function dashboardFilterParams(filters: DashboardFilters) {
  return { category: filters.category, customer: filters.customerId, assignee: filters.assigneeId };
}

export function activeFilterCount(filters: DashboardFilters): number {
  return [filters.category, filters.customerId, filters.assigneeId].filter((v) => v !== undefined).length;
}
