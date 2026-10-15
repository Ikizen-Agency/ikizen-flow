import { describe, expect, it } from "vitest";
import {
  assertOrderDeletable,
  assertOrderEditable,
  assertOrderTransition,
  assertTotalCoversPayments,
  deleteBlockedReason,
  editBlockedReason,
  type OrderStatus,
  canDeleteOrder,
  canEditOrder,
  OrderNotDeletableError,
  OrderNotEditableError,
  canTransitionOrder,
  computeOrderTotals,
  daysOverdue,
  dueDateFor,
  effectiveOrderStatus,
  InvalidOrderTransitionError,
  nextOrderReference,
  orderStatusTone,
  overdueCutoff,
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

describe("overdueCutoff", () => {
  it("is the boundary used to filter overdue orders in storage", () => {
    const cutoff = overdueCutoff(now);
    const justBefore = new Date(cutoff.getTime() - 1);
    expect(effectiveOrderStatus({ status: "invoiced", dueDate: justBefore }, now)).toBe("overdue");
    expect(effectiveOrderStatus({ status: "invoiced", dueDate: cutoff }, now)).toBe("invoiced");
  });
});

describe("orderStatusTone", () => {
  it("maps display statuses to badge tones", () => {
    expect(orderStatusTone("completed")).toBe("success");
    expect(orderStatusTone("invoiced")).toBe("info");
    expect(orderStatusTone("pending")).toBe("warning");
    expect(orderStatusTone("overdue")).toBe("danger");
    expect(orderStatusTone("draft")).toBe("neutral");
  });
});

describe("order editing and deletion rules", () => {
  const unpaid = (status: OrderStatus) => ({ reference: "SL-1", status, paidCents: 0 });

  it("lets unpaid drafts and pending orders be reopened in the composer", () => {
    expect(canEditOrder(unpaid("draft"))).toBe(true);
    expect(canEditOrder(unpaid("pending"))).toBe(true);
    expect(editBlockedReason(unpaid("pending"))).toBeNull();
    expect(() => assertOrderEditable(unpaid("draft"))).not.toThrow();
  });

  it("rejects editing orders that are in progress, invoiced or closed", () => {
    for (const status of ["processing", "invoiced", "completed", "cancelled"] as const) {
      expect(canEditOrder(unpaid(status))).toBe(false);
      expect(() => assertOrderEditable(unpaid(status))).toThrow(OrderNotEditableError);
    }
  });

  it("rejects editing an order that already has recorded payments", () => {
    const paid = { reference: "SL-1", status: "pending" as const, paidCents: 1 };
    expect(canEditOrder(paid)).toBe(false);
    expect(editBlockedReason(paid)).toBe("Remove recorded payments before editing this order.");
    expect(() => assertOrderEditable(paid)).toThrow(new OrderNotEditableError("SL-1", "pending", "Remove recorded payments before editing this order."));
  });

  it("never lets a new total fall below what was already paid", () => {
    expect(() => assertTotalCoversPayments("SL-1", 5_000, 5_000)).not.toThrow();
    expect(() => assertTotalCoversPayments("SL-1", 4_999, 5_000)).toThrow(OrderNotEditableError);
  });

  it("only deletes unpaid drafts and cancelled orders", () => {
    expect(canDeleteOrder(unpaid("draft"))).toBe(true);
    expect(canDeleteOrder(unpaid("cancelled"))).toBe(true);
    expect(deleteBlockedReason(unpaid("cancelled"))).toBeNull();
    for (const status of ["pending", "processing", "invoiced", "completed"] as const) {
      expect(canDeleteOrder(unpaid(status))).toBe(false);
      expect(() => assertOrderDeletable(unpaid(status))).toThrow(OrderNotDeletableError);
    }
  });

  it("refuses to delete an order with recorded payments, even once cancelled", () => {
    const paid = { reference: "SL-1", status: "cancelled" as const, paidCents: 2_500 };
    expect(canDeleteOrder(paid)).toBe(false);
    expect(deleteBlockedReason(paid)).toBe("Orders with recorded payments cannot be deleted.");
    expect(() => assertOrderDeletable(paid)).toThrow("Orders with recorded payments cannot be deleted.");
  });
});
