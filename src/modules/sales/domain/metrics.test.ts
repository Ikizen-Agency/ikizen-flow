import { describe, expect, it } from "vitest";
import { billedBetween, openPipelineCents, type OrderSummary } from "./metrics";

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
