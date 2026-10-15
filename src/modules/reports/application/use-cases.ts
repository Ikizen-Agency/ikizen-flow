import type { Clock } from "../../shared-types";
import { revenueByCategory } from "../../dashboard/domain/dashboard";
import { receivablesAging } from "../../invoices/domain/invoice";
import { INVOICED_ORDER_STATUSES } from "../../sales/domain/order";
import { resolveReportRange, type ReportRangeParams } from "../domain/date-range";
import { pipelineByStatus, revenueOverTime, taskThroughput, timeLogged, topCustomers } from "../domain/reports";
import type { ReportsRepository } from "./ports";

export interface ReportsDeps {
  reports: ReportsRepository;
  clock: Clock;
}

const TOP_CUSTOMERS = 10;

/** Every report section for the requested range; aging is always "as of today". */
export const makeGetReport =
  ({ reports, clock }: ReportsDeps) =>
  async (params: ReportRangeParams) => {
    const now = clock();
    const range = resolveReportRange(params, now);
    const [orders, payments, tasks, entries] = await Promise.all([reports.orderFacts(), reports.paymentFacts(range), reports.taskFacts(), reports.timeEntries(range)]);
    const invoices = orders.filter((o) => o.invoiceNumber !== null && (INVOICED_ORDER_STATUSES as ReadonlyArray<string>).includes(o.status));
    return {
      now,
      range,
      revenue: revenueOverTime(orders, payments, range),
      categories: revenueByCategory(orders, range),
      customers: topCustomers(orders, payments, range, TOP_CUSTOMERS),
      pipeline: pipelineByStatus(orders, range, now),
      aging: receivablesAging(invoices, now),
      tasks: taskThroughput(tasks, range, now),
      time: timeLogged(entries, range),
    };
  };

export type Report = Awaited<ReturnType<ReturnType<typeof makeGetReport>>>;
