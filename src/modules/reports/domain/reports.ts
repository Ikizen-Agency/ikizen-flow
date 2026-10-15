/**
 * Pure aggregations behind the reports page. Every function takes workspace-scoped facts and a half-open
 * UTC range [start, end); money is integer cents. Balances come from the sales domain (`orderBalance`).
 */
import type { Cents } from "@/shared/domain/money";
import { addDays, daysBetween, MS_PER_DAY, startOfDay } from "@/shared/domain/time";
import { isBillable, isOpen } from "../../sales/domain/metrics";
import { effectiveOrderStatus, type EffectiveOrderStatus, type OrderCategory, type OrderStatus } from "../../sales/domain/order";
import { orderBalance } from "../../sales/domain/payment";
import { taskDueState, type TaskStatus } from "../../tasks/domain/task";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ReportOrderFact {
  id: number;
  customerId: number;
  customerCompany: string;
  category: OrderCategory;
  status: OrderStatus;
  amountCents: Cents;
  paidCents: Cents;
  invoiceNumber: string | null;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
}

export interface ReportPaymentFact {
  orderId: number;
  customerId: number;
  amountCents: Cents;
  paidAt: Date;
}

export interface ReportTaskFact {
  id: number;
  status: TaskStatus;
  assigneeId: number | null;
  assigneeName: string | null;
  createdAt: Date;
  completedAt: Date | null;
  dueAt: Date | null;
}

export interface ReportTimeEntryFact {
  memberId: number | null;
  memberName: string | null;
  taskId: number;
  minutes: number;
  loggedAt: Date;
}

const within = (date: Date, range: DateRange) => date >= range.start && date < range.end;
const oneDecimal = (n: number) => Math.round(n * 10) / 10;
const average = (values: ReadonlyArray<number>) => (values.length ? oneDecimal(values.reduce((a, b) => a + b, 0) / values.length) : null);

const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const weekLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export interface Bucket {
  start: Date;
  end: Date;
  label: string;
}

/** Calendar months overlapping the range (clipped to it), oldest first. */
export function monthsIn(range: DateRange): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1));
  while (cursor < range.end) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    buckets.push({ start: cursor < range.start ? range.start : cursor, end: next > range.end ? range.end : next, label: monthLabel.format(cursor) });
    cursor = next;
  }
  return buckets;
}

/** Monday-based weeks overlapping the range (clipped to it), labelled by their first day in range. */
export function weeksIn(range: DateRange): Bucket[] {
  const buckets: Bucket[] = [];
  const first = startOfDay(range.start);
  let cursor = addDays(first, -((first.getUTCDay() + 6) % 7));
  while (cursor < range.end) {
    const next = addDays(cursor, 7);
    const start = cursor < range.start ? range.start : cursor;
    buckets.push({ start, end: next > range.end ? range.end : next, label: weekLabel.format(start) });
    cursor = next;
  }
  return buckets;
}

export interface RevenueMonth {
  label: string;
  start: Date;
  billedCents: Cents;
  collectedCents: Cents;
}

/** Billed (billable orders by issue date) vs collected (payments by payment date), per month of the range. */
export function revenueOverTime(orders: ReadonlyArray<ReportOrderFact>, payments: ReadonlyArray<ReportPaymentFact>, range: DateRange) {
  const months: RevenueMonth[] = monthsIn(range).map((m) => ({
    label: m.label,
    start: m.start,
    billedCents: orders.filter((o) => isBillable(o.status) && within(o.issueDate, m)).reduce((s, o) => s + o.amountCents, 0),
    collectedCents: payments.filter((p) => within(p.paidAt, m)).reduce((s, p) => s + p.amountCents, 0),
  }));
  return {
    months,
    billedCents: months.reduce((s, m) => s + m.billedCents, 0),
    collectedCents: months.reduce((s, m) => s + m.collectedCents, 0),
  };
}

export interface CustomerReportRow {
  customerId: number;
  company: string;
  billedCents: Cents;
  collectedCents: Cents;
  /** Current balance of open orders issued in the range. */
  outstandingCents: Cents;
  /** Billable orders issued in the range. */
  orders: number;
}

/** Customers ranked by billed amount in the range (then collected); customers with no activity are left out. */
export function topCustomers(orders: ReadonlyArray<ReportOrderFact>, payments: ReadonlyArray<ReportPaymentFact>, range: DateRange, limit = 10): CustomerReportRow[] {
  const companies = new Map(orders.map((o) => [o.customerId, o.customerCompany]));
  const rows = new Map<number, CustomerReportRow>();
  const row = (customerId: number) => {
    let r = rows.get(customerId);
    if (!r) {
      r = { customerId, company: companies.get(customerId) ?? "Unknown client", billedCents: 0, collectedCents: 0, outstandingCents: 0, orders: 0 };
      rows.set(customerId, r);
    }
    return r;
  };
  for (const o of orders) {
    if (!isBillable(o.status) || !within(o.issueDate, range)) continue;
    const r = row(o.customerId);
    r.billedCents += o.amountCents;
    r.orders += 1;
    if (isOpen(o.status)) r.outstandingCents += orderBalance(o);
  }
  for (const p of payments) if (within(p.paidAt, range)) row(p.customerId).collectedCents += p.amountCents;
  return [...rows.values()]
    .sort((a, b) => b.billedCents - a.billedCents || b.collectedCents - a.collectedCents || a.company.localeCompare(b.company))
    .slice(0, limit);
}

/** Lifecycle order for the pipeline table (overdue sits after invoiced). */
export const PIPELINE_STATUSES: ReadonlyArray<EffectiveOrderStatus> = ["draft", "pending", "processing", "invoiced", "overdue", "completed", "cancelled"];

/** Orders issued in the range by effective status (overdue derived as of `now`). */
export function pipelineByStatus(orders: ReadonlyArray<ReportOrderFact>, range: DateRange, now: Date) {
  const totals = new Map<EffectiveOrderStatus, { count: number; cents: Cents }>(PIPELINE_STATUSES.map((s) => [s, { count: 0, cents: 0 }]));
  for (const o of orders) {
    if (!within(o.issueDate, range)) continue;
    const t = totals.get(effectiveOrderStatus(o, now))!;
    t.count += 1;
    t.cents += o.amountCents;
  }
  return PIPELINE_STATUSES.map((status) => ({ status, ...totals.get(status)! }));
}

const cycleDays = (t: ReportTaskFact & { completedAt: Date }) => Math.max(0, (t.completedAt.getTime() - t.createdAt.getTime()) / MS_PER_DAY);

/** Created vs completed tasks per week and per assignee, cycle time of tasks completed in range, open overdue tasks now. */
export function taskThroughput(tasks: ReadonlyArray<ReportTaskFact>, range: DateRange, now: Date) {
  const completed = tasks.filter((t): t is ReportTaskFact & { completedAt: Date } => t.status === "completed" && t.completedAt !== null && within(t.completedAt, range));
  const created = tasks.filter((t) => within(t.createdAt, range));
  const weeks = weeksIn(range).map((w) => ({
    label: w.label,
    start: w.start,
    created: created.filter((t) => within(t.createdAt, w)).length,
    completed: completed.filter((t) => within(t.completedAt, w)).length,
  }));
  const people = new Map<number | null, { assigneeId: number | null; name: string; created: number; cycles: number[] }>();
  const person = (t: ReportTaskFact) => {
    let p = people.get(t.assigneeId);
    if (!p) {
      p = { assigneeId: t.assigneeId, name: t.assigneeName ?? "Unassigned", created: 0, cycles: [] };
      people.set(t.assigneeId, p);
    }
    return p;
  };
  for (const t of created) person(t).created += 1;
  for (const t of completed) person(t).cycles.push(cycleDays(t));
  const byAssignee = [...people.values()]
    .map((p) => ({ assigneeId: p.assigneeId, name: p.name, created: p.created, completed: p.cycles.length, averageCycleDays: average(p.cycles) }))
    .sort((a, b) => b.completed - a.completed || b.created - a.created || a.name.localeCompare(b.name));
  return {
    weeks,
    byAssignee,
    createdCount: created.length,
    completedCount: completed.length,
    averageCycleDays: average(completed.map(cycleDays)),
    overdueCount: tasks.filter((t) => taskDueState(t, now) === "overdue").length,
  };
}

/** Minutes logged per member within the range, largest first. */
export function timeLogged(entries: ReadonlyArray<ReportTimeEntryFact>, range: DateRange) {
  const members = new Map<number | null, { memberId: number | null; name: string; minutes: number; entries: number; tasks: Set<number> }>();
  for (const e of entries) {
    if (!within(e.loggedAt, range)) continue;
    let m = members.get(e.memberId);
    if (!m) {
      m = { memberId: e.memberId, name: e.memberName ?? "Former member", minutes: 0, entries: 0, tasks: new Set() };
      members.set(e.memberId, m);
    }
    m.minutes += e.minutes;
    m.entries += 1;
    m.tasks.add(e.taskId);
  }
  const rows = [...members.values()]
    .map(({ tasks, ...m }) => ({ ...m, tasks: tasks.size }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  return { totalMinutes: rows.reduce((s, r) => s + r.minutes, 0), members: rows };
}

/** Whole days in the range, for captions. */
export function rangeDays(range: DateRange): number {
  return daysBetween(range.start, range.end);
}
