import { describe, expect, it } from "vitest";
import {
  billedBetween,
  computeSalesKpis,
  countByEffectiveStatus,
  onTimeDeliveryRate,
  openPipelineCents,
  weeklyBilledTotals,
  weightedPipelineCents,
  type OrderSummary,
} from "./metrics";

const now = new Date("2026-10-14T12:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000);

function order(partial: Partial<OrderSummary>): OrderSummary {
  return {
    id: 1,
    customerId: 1,
    status: "completed",
    amountCents: 100_00,
    issueDate: day(5),
    dueDate: day(-25),
    paidAt: null,
    ...partial,
  };
}

describe("openPipelineCents", () => {
  it("sums orders that are still expected to bring money in", () => {
    const orders = [
      order({ status: "pending", amountCents: 1_000 }),
      order({ status: "processing", amountCents: 2_000 }),
      order({ status: "invoiced", amountCents: 3_000, dueDate: day(10) }),
      order({ status: "completed", amountCents: 9_000 }),
      order({ status: "draft", amountCents: 9_000 }),
    ];
    expect(openPipelineCents(orders)).toBe(6_000);
  });
});

describe("billedBetween", () => {
  it("sums non-draft, non-cancelled orders issued within [from, to)", () => {
    const orders = [
      order({ amountCents: 1_000, issueDate: day(1) }),
      order({ amountCents: 2_000, issueDate: day(29), status: "invoiced" }),
      order({ amountCents: 4_000, issueDate: day(31) }),
      order({ amountCents: 8_000, issueDate: day(2), status: "draft" }),
      order({ amountCents: 8_000, issueDate: day(2), status: "cancelled" }),
    ];
    expect(billedBetween(orders, day(30), now)).toBe(3_000);
    expect(billedBetween(orders, day(60), day(30))).toBe(4_000);
  });
});

describe("weightedPipelineCents", () => {
  it("weights open orders by how close they are to cash", () => {
    const orders = [
      order({ status: "pending", amountCents: 10_000 }),
      order({ status: "processing", amountCents: 10_000 }),
      order({ status: "invoiced", amountCents: 10_000 }),
      order({ status: "completed", amountCents: 10_000 }),
    ];
    expect(weightedPipelineCents(orders)).toBe(5_000 + 7_500 + 9_000);
  });
});

describe("computeSalesKpis", () => {
  it("compares the trailing 30 days with the prior window", () => {
    const orders = [
      order({ status: "completed", amountCents: 4_000, issueDate: day(3) }),
      order({ status: "completed", amountCents: 2_000, issueDate: day(10) }),
      order({ status: "invoiced", amountCents: 6_000, issueDate: day(12), dueDate: day(-18) }),
      order({ status: "pending", amountCents: 4_000, issueDate: day(1), dueDate: day(-29) }),
      order({ status: "completed", amountCents: 5_000, issueDate: day(40) }),
      order({ status: "cancelled", amountCents: 9_999, issueDate: day(2) }),
      order({ status: "draft", amountCents: 9_999, issueDate: day(2) }),
    ];
    const kpis = computeSalesKpis(orders, now);
    expect(kpis.periodSalesCents).toBe(16_000);
    expect(kpis.priorPeriodSalesCents).toBe(5_000);
    expect(kpis.salesChange).toBeCloseTo(2.2);
    expect(kpis.pipelineCents).toBe(10_000);
    expect(kpis.activeCount).toBe(2);
    expect(kpis.executedCount).toBe(2);
    expect(kpis.averageDealCents).toBe(3_000);
    expect(kpis.averageDealChange).toBeCloseTo(-0.4);
    // Converted (processing/invoiced/completed) over every non-draft order.
    expect(kpis.conversionRate).toBeCloseTo(4 / 6);
  });

  it("handles an empty book", () => {
    const kpis = computeSalesKpis([], now);
    expect(kpis).toMatchObject({ periodSalesCents: 0, salesChange: null, averageDealCents: 0, conversionRate: 0 });
  });
});

describe("onTimeDeliveryRate", () => {
  it("is the share of paid orders settled on or before their due date", () => {
    const orders = [
      order({ status: "completed", dueDate: day(10), paidAt: day(12) }),
      order({ status: "completed", dueDate: day(10), paidAt: day(10) }),
      order({ status: "completed", dueDate: day(10), paidAt: day(9) }),
      order({ status: "invoiced", dueDate: day(10), paidAt: null }),
    ];
    expect(onTimeDeliveryRate(orders)).toBeCloseTo(2 / 3);
    expect(onTimeDeliveryRate([])).toBeNull();
  });
});

describe("weeklyBilledTotals", () => {
  it("buckets billable amounts into trailing 7-day windows, oldest first", () => {
    const orders = [
      order({ amountCents: 100, issueDate: day(1) }),
      order({ amountCents: 200, issueDate: day(6) }),
      order({ amountCents: 400, issueDate: day(8) }),
      order({ amountCents: 800, issueDate: day(41) }),
      order({ amountCents: 1_600, issueDate: day(50) }),
    ];
    expect(weeklyBilledTotals(orders, now, 6)).toEqual([800, 0, 0, 0, 400, 300]);
  });
});

describe("countByEffectiveStatus", () => {
  it("counts overdue separately from the stored status", () => {
    const counts = countByEffectiveStatus(
      [
        order({ status: "invoiced", dueDate: day(3) }),
        order({ status: "invoiced", dueDate: day(-3) }),
        order({ status: "completed" }),
        order({ status: "draft" }),
      ],
      now,
    );
    expect(counts).toMatchObject({ all: 4, invoiced: 1, overdue: 1, completed: 1, draft: 1, pending: 0 });
  });
});
