import type { CsvCell } from "@/shared/domain/csv";
import type { Cents } from "@/shared/domain/money";
import { ORDER_CATEGORY_LABELS, ORDER_STATUS_LABELS } from "../../sales/domain/order";
import type { Report } from "../application/use-cases";

export const REPORT_SECTIONS = ["revenue", "categories", "customers", "pipeline", "aging", "tasks", "assignees", "time"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const REPORT_SECTION_LABELS: Record<ReportSection, string> = {
  revenue: "Revenue over time",
  categories: "Revenue by category",
  customers: "Top customers",
  pipeline: "Sales pipeline",
  aging: "Receivables aging",
  tasks: "Task throughput",
  assignees: "Throughput by assignee",
  time: "Team time logged",
};

const dollars = (cents: Cents) => (cents / 100).toFixed(2);
const hours = (minutes: number) => (minutes / 60).toFixed(2);
const optional = (n: number | null) => (n === null ? "" : n);

/** Header + rows of one report section (cells are escaped by `toCsv`). Missing sections yield only the header. */
export function reportSectionCsv(section: ReportSection, report: Partial<Report>): CsvCell[][] {
  switch (section) {
    case "revenue":
      return [["Month", "Billed (USD)", "Collected (USD)"], ...(report.revenue?.months ?? []).map((m) => [m.label, dollars(m.billedCents), dollars(m.collectedCents)])];
    case "categories":
      return [
        ["Category", "Billed (USD)", "Share (%)", "Orders", "Clients"],
        ...(report.categories?.categories ?? []).map((c) => [ORDER_CATEGORY_LABELS[c.category], dollars(c.cents), c.percent, c.orders, c.customers]),
      ];
    case "customers":
      return [
        ["Client", "Billed (USD)", "Collected (USD)", "Outstanding (USD)", "Orders"],
        ...(report.customers ?? []).map((c) => [c.company, dollars(c.billedCents), dollars(c.collectedCents), dollars(c.outstandingCents), c.orders]),
      ];
    case "pipeline":
      return [["Status", "Orders", "Amount (USD)"], ...(report.pipeline ?? []).map((p) => [ORDER_STATUS_LABELS[p.status], p.count, dollars(p.cents)])];
    case "aging":
      return [["Bucket", "Invoices", "Balance (USD)"], ...(report.aging?.buckets ?? []).map((b) => [b.label, b.count, dollars(b.cents)])];
    case "tasks":
      return [["Week of", "Created", "Completed"], ...(report.tasks?.weeks ?? []).map((w) => [w.start.toISOString().slice(0, 10), w.created, w.completed])];
    case "assignees":
      return [
        ["Assignee", "Created", "Completed", "Average cycle (days)"],
        ...(report.tasks?.byAssignee ?? []).map((a) => [a.name, a.created, a.completed, optional(a.averageCycleDays)]),
      ];
    case "time":
      return [["Member", "Hours", "Entries", "Tasks"], ...(report.time?.members ?? []).map((m) => [m.name, hours(m.minutes), m.entries, m.tasks])];
  }
}
