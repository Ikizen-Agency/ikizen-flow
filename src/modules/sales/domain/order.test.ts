import { describe, expect, it } from "vitest";
import {
  assertOrderTransition,
  canTransitionOrder,
  computeOrderTotals,
  daysOverdue,
  dueDateFor,
  effectiveOrderStatus,
  InvalidOrderTransitionError,
  nextOrderReference,
} from "./order";

const now = new Date("2026-10-14T12:00:00Z");

describe("order status transitions", () => {
  it("follows the commercial lifecycle draft -> pending -> processing -> invoiced -> completed", () => {
    expect(canTransitionOrder("draft", "pending")).toBe(true);
    expect(canTransitionOrder("pending", "processing")).toBe(true);
    expect(canTransitionOrder("processing", "invoiced")).toBe(true);
    expect(canTransitionOrder("invoiced", "completed")).toBe(true);
  });

  it("allows cancelling open orders but never reopening closed ones", () => {
    expect(canTransitionOrder("pending", "cancelled")).toBe(true);
    expect(canTransitionOrder("completed", "pending")).toBe(false);
    expect(canTransitionOrder("cancelled", "draft")).toBe(false);
    expect(canTransitionOrder("invoiced", "draft")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(canTransitionOrder("pending", "pending")).toBe(false);
  });

  it("throws a domain error for an invalid transition", () => {
    expect(() => assertOrderTransition("completed", "draft")).toThrow(InvalidOrderTransitionError);
    expect(() => assertOrderTransition("draft", "pending")).not.toThrow();
  });
});

describe("overdue computation", () => {
  it("marks open orders past their due date as overdue", () => {
    const order = { status: "invoiced" as const, dueDate: new Date("2026-10-02T00:00:00Z") };
    expect(effectiveOrderStatus(order, now)).toBe("overdue");
    expect(daysOverdue(order, now)).toBe(12);
  });

  it("never marks drafts, completed or cancelled orders as overdue", () => {
    const due = new Date("2026-09-01T00:00:00Z");
    expect(effectiveOrderStatus({ status: "completed", dueDate: due }, now)).toBe("completed");
    expect(effectiveOrderStatus({ status: "draft", dueDate: due }, now)).toBe("draft");
    expect(daysOverdue({ status: "cancelled", dueDate: due }, now)).toBe(0);
  });

  it("does not consider an order due today as overdue", () => {
    const order = { status: "pending" as const, dueDate: new Date("2026-10-14T00:00:00Z") };
    expect(effectiveOrderStatus(order, now)).toBe("pending");
    expect(daysOverdue(order, now)).toBe(0);
  });
});

describe("payment terms", () => {
  it("derives the due date from the issue date", () => {
    const issued = new Date("2026-10-31T00:00:00Z");
    expect(dueDateFor(issued, "net_30").toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(dueDateFor(issued, "net_15").toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(dueDateFor(issued, "due_on_receipt").toISOString()).toBe(issued.toISOString());
  });
});

describe("computeOrderTotals", () => {
  it("sums line items, applies the early settlement incentive and tax", () => {
    const totals = computeOrderTotals(
      [
        { quantity: 1, unitRateCents: 850000 },
        { quantity: 40, unitRateCents: 16500 },
      ],
      { discountBps: 500, taxBps: 0 },
    );
    expect(totals).toEqual({ subtotalCents: 1510000, discountCents: 75500, taxCents: 0, totalCents: 1434500 });
  });

  it("taxes the discounted subtotal", () => {
    const totals = computeOrderTotals([{ quantity: 2, unitRateCents: 10000 }], { discountBps: 1000, taxBps: 2000 });
    expect(totals).toEqual({ subtotalCents: 20000, discountCents: 2000, taxCents: 3600, totalCents: 21600 });
  });

  it("returns zero totals for an empty order", () => {
    expect(computeOrderTotals([]).totalCents).toBe(0);
  });

  it("rejects negative quantities or rates", () => {
    expect(() => computeOrderTotals([{ quantity: -1, unitRateCents: 100 }])).toThrow();
  });
});

describe("nextOrderReference", () => {
  it("increments the numeric part of the latest reference", () => {
    expect(nextOrderReference("SL-1048")).toBe("SL-1049");
  });

  it("starts the sequence when there are no orders", () => {
    expect(nextOrderReference(null)).toBe("SL-1001");
  });
});
