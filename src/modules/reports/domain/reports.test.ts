import { describe, expect, it } from "vitest";
import { reportSectionCsv } from "./report-csv";
import {
  pipelineByStatus,
  revenueOverTime,
  taskThroughput,
  timeLogged,
  topCustomers,
  weeksIn,
  type ReportOrderFact,
  type ReportPaymentFact,
  type ReportTaskFact,
} from "./reports";

const now = new Date("2026-10-14T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const range = { start: day("2026-08-01"), end: day("2026-10-15") };

const order = (overrides: Partial<ReportOrderFact>): ReportOrderFact => ({
  id: 1,
  customerId: 1,
  customerCompany: "Acme",
  category: "custom_software",
  status: "invoiced",
  amountCents: 100_000,
  paidCents: 0,
  invoiceNumber: "INV-1",
  issueDate: day("2026-09-10"),
  dueDate: day("2026-10-10"),
  paidAt: null,
  ...overrides,
});

const payment = (overrides: Partial<ReportPaymentFact>): ReportPaymentFact => ({ orderId: 1, customerId: 1, amountCents: 10_000, paidAt: day("2026-09-15"), ...overrides });

describe("revenueOverTime", () => {
  it("buckets billed (by issue date, billable only) and collected (by payment date) per month of the range", () => {
    const result = revenueOverTime(
      [
        order({ id: 1, issueDate: day("2026-08-05"), amountCents: 50_000 }),
        order({ id: 2, issueDate: day("2026-09-10"), amountCents: 70_000 }),
        order({ id: 3, issueDate: day("2026-09-11"), status: "draft", amountCents: 999_000 }),
        order({ id: 4, issueDate: day("2026-07-31"), amountCents: 999_000 }),
      ],
      [payment({ paidAt: day("2026-09-15"), amountCents: 20_000 }), payment({ paidAt: day("2026-10-01"), amountCents: 5_000 })],
      range,
    );
    expect(result.months.map((m) => [m.label, m.billedCents, m.collectedCents])).toEqual([
      ["Aug 2026", 50_000, 0],
      ["Sep 2026", 70_000, 20_000],
      ["Oct 2026", 0, 5_000],
    ]);
    expect(result.billedCents).toBe(120_000);
    expect(result.collectedCents).toBe(25_000);
  });
});

describe("topCustomers", () => {
  it("ranks customers by billed amount with collected, outstanding and order counts", () => {
    const rows = topCustomers(
      [
        order({ id: 1, customerId: 1, customerCompany: "Acme", amountCents: 100_000, paidCents: 40_000 }),
        order({ id: 2, customerId: 1, customerCompany: "Acme", status: "completed", amountCents: 50_000, paidCents: 50_000 }),
        order({ id: 3, customerId: 2, customerCompany: "Beta", amountCents: 300_000 }),
        order({ id: 4, customerId: 3, customerCompany: "Gamma", status: "cancelled", amountCents: 900_000 }),
        order({ id: 5, customerId: 4, customerCompany: "Old", issueDate: day("2026-01-01") }),
      ],
      [payment({ customerId: 1, amountCents: 40_000 }), payment({ customerId: 1, amountCents: 50_000 }), payment({ customerId: 4, amountCents: 1_000 })],
      range,
      10,
    );
    expect(rows).toEqual([
      { customerId: 2, company: "Beta", billedCents: 300_000, collectedCents: 0, outstandingCents: 300_000, orders: 1 },
      { customerId: 1, company: "Acme", billedCents: 150_000, collectedCents: 90_000, outstandingCents: 60_000, orders: 2 },
      { customerId: 4, company: "Old", billedCents: 0, collectedCents: 1_000, outstandingCents: 0, orders: 0 },
    ]);
  });
});

describe("pipelineByStatus", () => {
  it("counts orders issued in range by effective status, overdue derived", () => {
    const rows = pipelineByStatus(
      [
        order({ status: "pending", dueDate: day("2026-11-01"), amountCents: 10 }),
        order({ status: "invoiced", dueDate: day("2026-10-01"), amountCents: 20 }),
        order({ status: "completed", amountCents: 30 }),
        order({ status: "completed", amountCents: 40, issueDate: day("2025-01-01") }),
      ],
      range,
      now,
    );
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, [r.count, r.cents]]));
    expect(byStatus).toMatchObject({ pending: [1, 10], overdue: [1, 20], completed: [1, 30], invoiced: [0, 0], draft: [0, 0] });
    expect(rows.map((r) => r.status)).toEqual(["draft", "pending", "processing", "invoiced", "overdue", "completed", "cancelled"]);
  });
});

describe("weeksIn", () => {
  it("splits a range into Monday-based weeks clipped to the range", () => {
    const weeks = weeksIn({ start: day("2026-10-01"), end: day("2026-10-15") });
    expect(weeks.map((w) => [w.start.toISOString().slice(0, 10), w.end.toISOString().slice(0, 10)])).toEqual([
      ["2026-10-01", "2026-10-05"],
      ["2026-10-05", "2026-10-12"],
      ["2026-10-12", "2026-10-15"],
    ]);
    expect(weeks[1]!.label).toBe("Oct 5");
  });
});

describe("taskThroughput", () => {
  const task = (overrides: Partial<ReportTaskFact>): ReportTaskFact => ({
    id: 1,
    status: "todo",
    assigneeId: 1,
    assigneeName: "Alex",
    createdAt: day("2026-10-02"),
    completedAt: null,
    dueAt: null,
    ...overrides,
  });

  it("counts created vs completed per week and per assignee, with cycle time and overdue tasks", () => {
    const result = taskThroughput(
      [
        task({ id: 1, createdAt: day("2026-10-02"), status: "completed", completedAt: day("2026-10-06") }),
        task({ id: 2, createdAt: day("2026-10-06"), status: "completed", completedAt: day("2026-10-08"), assigneeId: 2, assigneeName: "Maya" }),
        task({ id: 3, createdAt: day("2026-10-13"), dueAt: day("2026-10-13") }),
        task({ id: 4, createdAt: day("2026-01-01"), assigneeId: null, assigneeName: null, dueAt: day("2026-12-01") }),
      ],
      { start: day("2026-10-01"), end: day("2026-10-15") },
      now,
    );
    expect(result.weeks.map((w) => [w.label, w.created, w.completed])).toEqual([
      ["Oct 1", 1, 0],
      ["Oct 5", 1, 2],
      ["Oct 12", 1, 0],
    ]);
    expect(result.createdCount).toBe(3);
    expect(result.completedCount).toBe(2);
    expect(result.averageCycleDays).toBe(3);
    expect(result.overdueCount).toBe(1);
    expect(result.byAssignee).toEqual([
      { assigneeId: 1, name: "Alex", created: 2, completed: 1, averageCycleDays: 4 },
      { assigneeId: 2, name: "Maya", created: 1, completed: 1, averageCycleDays: 2 },
    ]);
  });
});

describe("timeLogged", () => {
  it("sums minutes per member within the range, largest first", () => {
    const result = timeLogged(
      [
        { memberId: 1, memberName: "Alex", taskId: 1, minutes: 90, loggedAt: day("2026-09-01") },
        { memberId: 1, memberName: "Alex", taskId: 2, minutes: 30, loggedAt: day("2026-09-02") },
        { memberId: 2, memberName: "Maya", taskId: 1, minutes: 240, loggedAt: day("2026-09-03") },
        { memberId: null, memberName: null, taskId: 3, minutes: 15, loggedAt: day("2026-09-03") },
        { memberId: 2, memberName: "Maya", taskId: 1, minutes: 600, loggedAt: day("2026-01-01") },
      ],
      range,
    );
    expect(result.totalMinutes).toBe(375);
    expect(result.members).toEqual([
      { memberId: 2, name: "Maya", minutes: 240, entries: 1, tasks: 1 },
      { memberId: 1, name: "Alex", minutes: 120, entries: 2, tasks: 2 },
      { memberId: null, name: "Former member", minutes: 15, entries: 1, tasks: 1 },
    ]);
  });
});

describe("reportSectionCsv", () => {
  it("serialises a section with a header row and dollar amounts", () => {
    const rows = reportSectionCsv("revenue", {
      revenue: { months: [{ label: "Sep 2026", start: day("2026-09-01"), billedCents: 12_345, collectedCents: 100 }], billedCents: 12_345, collectedCents: 100 },
    });
    expect(rows).toEqual([
      ["Month", "Billed (USD)", "Collected (USD)"],
      ["Sep 2026", "123.45", "1.00"],
    ]);
  });
});
