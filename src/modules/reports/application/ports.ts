import type { DateRange, ReportOrderFact, ReportPaymentFact, ReportTaskFact, ReportTimeEntryFact } from "../domain/reports";

/** Report facts of one workspace (the adapter is constructed for a workspace). */
export interface ReportsRepository {
  /** Every order with its paid total and client name. */
  orderFacts(): Promise<ReportOrderFact[]>;
  /** Payments received within the range. */
  paymentFacts(range: DateRange): Promise<ReportPaymentFact[]>;
  /** Every task with its assignee name. */
  taskFacts(): Promise<ReportTaskFact[]>;
  /** Time entries logged within the range, with the member name. */
  timeEntries(range: DateRange): Promise<ReportTimeEntryFact[]>;
}
