import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { DASHBOARD_PERIODS, type DashboardPeriod, type TrendMetric } from "../domain/dashboard";
import type { DashboardQuery } from "./use-cases";

/** URL state of the overview: `?period=month|quarter|year` and `?metric=gross|collected`. */
export function parseDashboardParams(params: SearchParamsRecord): DashboardQuery {
  const period = firstParam(params.period);
  const metric: TrendMetric = firstParam(params.metric) === "collected" ? "collected" : "gross";
  return {
    period: DASHBOARD_PERIODS.includes(period as DashboardPeriod) ? (period as DashboardPeriod) : "month",
    metric,
  };
}
