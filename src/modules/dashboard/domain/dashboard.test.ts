import { describe, expect, it } from "vitest";
import {
  attentionTasks,
  criticalTasks,
  greetingFor,
  outstandingInvoices,
  periodRange,
  projectedRunRateCents,
  revenueByCategory,
  revenueTrend,
  roundedShares,
  totalSales,
  type OrderFact,
} from "./dashboard";

const now = new Date("2026-10-15T12:00:00Z");
const d = (iso: string) => new Date(iso);

let nextId = 1;
const order = (over: Partial<OrderFact>): OrderFact => ({
  id: nextId++,
  customerId: 1,
  category: "custom_software",
  status: "completed",
  amountCents: 100_00,
  issueDate: d("2026-10-05T10:00:00Z"),
  dueDate: d("2026-11-04T10:00:00Z"),
  paidAt: null,
  ...over,
});

describe("periodRange", () => {
  it("covers the calendar month and compares with the same elapsed span of last month", () => {
    expect(periodRange("month", now)).toEqual({
      start: d("2026-10-01T00:00:00Z"),
      end: now,
      previousStart: d("2026-09-01T00:00:00Z"),
      previousEnd: d("2026-09-15T12:00:00Z"),
      label: "This Month (Oct 1 - Oct 31)",
      comparison: "vs last month",
    });
  });

  it("supports the quarter and year to date", () => {
    expect(periodRange("quarter", now)).toMatchObject({
      start: d("2026-10-01T00:00:00Z"),
      previousStart: d("2026-07-01T00:00:00Z"),
      previousEnd: d("2026-07-15T12:00:00Z"),
      label: "This Quarter (Oct 1 - Dec 31)",
      comparison: "vs last quarter",
    });
    expect(periodRange("year", now)).toMatchObject({
      start: d("2026-01-01T00:00:00Z"),
      previousStart: d("2025-01-01T00:00:00Z"),
      label: "Year to Date (Jan 1 - Oct 15)",
      comparison: "vs last year",
    });
  });
});

describe("totalSales", () => {
  it("sums billable orders in the period and the change against the previous span", () => {
    const orders = [
      order({ amountCents: 300_00, issueDate: d("2026-10-02T10:00:00Z") }),
      order({ amountCents: 100_00, status: "draft", issueDate: d("2026-10-03T10:00:00Z") }), // not billable
      order({ amountCents: 100_00, status: "cancelled", issueDate: d("2026-10-03T10:00:00Z") }),
      order({ amountCents: 200_00, status: "pending", issueDate: d("2026-09-10T10:00:00Z") }),
      order({ amountCents: 900_00, issueDate: d("2026-09-20T10:00:00Z") }), // after the comparable span
    ];
    expect(totalSales(orders, periodRange("month", now))).toEqual({ cents: 300_00, previousCents: 200_00, change: 0.5 });
  });
});

describe("revenueTrend", () => {
  const orders = [
    order({ amountCents: 500_00, issueDate: d("2026-10-02T10:00:00Z"), paidAt: d("2026-10-10T10:00:00Z") }),
    order({ amountCents: 700_00, status: "invoiced", issueDate: d("2026-08-02T10:00:00Z") }),
    order({ amountCents: 200_00, issueDate: d("2026-08-03T10:00:00Z"), paidAt: d("2026-09-01T10:00:00Z") }),
    order({ amountCents: 999_00, issueDate: d("2026-03-01T10:00:00Z") }), // outside the window
  ];

  it("buckets gross billings by issue month, oldest first, and marks the peak", () => {
    const trend = revenueTrend(orders, now, "gross");
    expect(trend.points.map((p) => [p.label, p.cents])).toEqual([
      ["May", 0],
      ["Jun", 0],
      ["Jul", 0],
      ["Aug", 900_00],
      ["Sep", 0],
      ["Oct", 500_00],
    ]);
    expect(trend.peakIndex).toBe(3);
    expect(trend.points.at(-1)?.current).toBe(true);
  });

  it("buckets collected cash by payment month", () => {
    const trend = revenueTrend(orders, now, "collected");
    expect(trend.points.map((p) => p.cents)).toEqual([0, 0, 0, 0, 200_00, 500_00]);
    expect(trend.peakIndex).toBe(5);
  });

  it("projects an annual run rate from the last three complete months", () => {
    expect(projectedRunRateCents(revenueTrend(orders, now, "gross").points)).toBe(Math.round((900_00 / 3) * 12));
  });
});

describe("revenueByCategory", () => {
  it("splits billable revenue by category with contract and client counts", () => {
    const orders = [
      order({ category: "custom_software", amountCents: 520_00, customerId: 1 }),
      order({ category: "ux_ui_retainer", amountCents: 140_00, customerId: 2 }),
      order({ category: "ux_ui_retainer", amountCents: 140_00, customerId: 2 }),
      order({ category: "cloud_architecture", amountCents: 200_00, customerId: 3 }),
      order({ category: "cloud_architecture", amountCents: 999_00, status: "draft" }),
    ];
    const result = revenueByCategory(orders, periodRange("month", now));
    expect(result.totalCents).toBe(1000_00);
    expect(result.categories).toEqual([
      { category: "custom_software", cents: 520_00, percent: 52, orders: 1, customers: 1 },
      { category: "ux_ui_retainer", cents: 280_00, percent: 28, orders: 2, customers: 1 },
      { category: "cloud_architecture", cents: 200_00, percent: 20, orders: 1, customers: 1 },
    ]);
  });
});

describe("roundedShares", () => {
  it("rounds to whole percentages that always add up to 100", () => {
    expect(roundedShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundedShares([2, 1])).toEqual([67, 33]);
    expect(roundedShares([0, 0])).toEqual([0, 0]);
  });
});

describe("outstandingInvoices", () => {
  it("totals unpaid invoices and counts the ones due within two weeks", () => {
    const result = outstandingInvoices(
      [
        order({ status: "invoiced", amountCents: 100_00, dueDate: d("2026-10-20T10:00:00Z") }), // due soon
        order({ status: "invoiced", amountCents: 200_00, dueDate: d("2026-10-01T10:00:00Z") }), // overdue
        order({ status: "invoiced", amountCents: 300_00, dueDate: d("2026-11-30T10:00:00Z") }), // later
        order({ status: "pending", amountCents: 999_00, dueDate: d("2026-10-20T10:00:00Z") }), // not invoiced
      ],
      now,
    );
    expect(result).toEqual({ cents: 600_00, count: 3, dueSoon: 1 });
  });
});

describe("task attention", () => {
  const task = (over: Partial<{ id: number; status: "todo" | "completed"; priority: "urgent" | "high" | "medium" | "low"; dueAt: Date | null }>) => ({
    id: nextId++,
    status: "todo" as const,
    priority: "medium" as const,
    dueAt: null,
    ...over,
  });
  const tasks = [
    task({ id: 1, dueAt: d("2026-10-13T10:00:00Z") }), // overdue
    task({ id: 2, priority: "urgent", dueAt: d("2026-10-15T16:00:00Z") }), // today
    task({ id: 3, priority: "high", dueAt: d("2026-10-15T14:30:00Z") }), // today, earlier
    task({ id: 4, dueAt: d("2026-10-16T10:00:00Z") }), // tomorrow
    task({ id: 5, dueAt: d("2026-10-25T10:00:00Z") }),
    task({ id: 6, status: "completed", dueAt: d("2026-10-15T10:00:00Z") }),
  ];

  it("counts overdue and due-today open tasks", () => {
    expect(attentionTasks(tasks, now)).toEqual({ total: 3, overdue: 1, dueToday: 2 });
  });

  it("lists open tasks due by tomorrow, soonest first, with the count due today", () => {
    const result = criticalTasks(tasks, now, 3);
    expect(result.items.map((t) => t.id)).toEqual([1, 3, 2]);
    expect(result.dueToday).toBe(2);
    expect(criticalTasks(tasks, now, 10).items.map((t) => t.id)).toEqual([1, 3, 2, 4]);
  });
});

describe("greetingFor", () => {
  it("greets by time of day in the given zone", () => {
    expect(greetingFor(d("2026-10-15T08:00:00Z"), "UTC")).toBe("Good morning");
    expect(greetingFor(d("2026-10-15T13:00:00Z"), "UTC")).toBe("Good afternoon");
    expect(greetingFor(d("2026-10-15T19:00:00Z"), "UTC")).toBe("Good evening");
    expect(greetingFor(d("2026-10-15T03:00:00Z"), "America/Chicago")).toBe("Good evening");
  });
});
