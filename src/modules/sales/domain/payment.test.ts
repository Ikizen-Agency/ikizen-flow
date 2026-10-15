import { describe, expect, it } from "vitest";
import { assertPaymentAllowed, orderBalance, PaymentRejectedError, statusAfterPayment, statusAfterPaymentRemoval } from "./payment";

const invoiced = { status: "invoiced" as const, amountCents: 100_000, paidCents: 30_000 };

describe("orderBalance", () => {
  it("is the total minus payments, never negative", () => {
    expect(orderBalance(invoiced)).toBe(70_000);
    expect(orderBalance({ amountCents: 100, paidCents: 150 })).toBe(0);
  });
});

describe("assertPaymentAllowed", () => {
  it("accepts partial payments and paying the exact balance", () => {
    expect(() => assertPaymentAllowed(invoiced, 10_000)).not.toThrow();
    expect(() => assertPaymentAllowed(invoiced, 70_000)).not.toThrow();
    expect(() => assertPaymentAllowed({ ...invoiced, status: "pending" }, 5_000)).not.toThrow();
    expect(() => assertPaymentAllowed({ ...invoiced, status: "processing" }, 5_000)).not.toThrow();
  });

  it("rejects overpaying the balance", () => {
    expect(() => assertPaymentAllowed(invoiced, 70_001)).toThrow(/exceeds the outstanding balance/);
  });

  it("rejects non-positive or fractional amounts", () => {
    expect(() => assertPaymentAllowed(invoiced, 0)).toThrow(PaymentRejectedError);
    expect(() => assertPaymentAllowed(invoiced, -5)).toThrow(PaymentRejectedError);
    expect(() => assertPaymentAllowed(invoiced, 10.5)).toThrow(PaymentRejectedError);
  });

  it("rejects payments on drafts, cancelled and completed orders", () => {
    for (const status of ["draft", "cancelled", "completed"] as const) {
      expect(() => assertPaymentAllowed({ ...invoiced, status }, 1_000)).toThrow(PaymentRejectedError);
    }
  });
});

describe("statusAfterPayment", () => {
  it("completes an invoiced or processing order once it is fully paid", () => {
    expect(statusAfterPayment("invoiced", 100_000, 100_000)).toBe("completed");
    expect(statusAfterPayment("processing", 100_000, 100_000)).toBe("completed");
  });

  it("keeps the status while a balance remains or when the lifecycle forbids completion", () => {
    expect(statusAfterPayment("invoiced", 100_000, 99_999)).toBeNull();
    // pending -> completed is not an allowed transition: the order stays pending, fully prepaid.
    expect(statusAfterPayment("pending", 100_000, 100_000)).toBeNull();
  });
});

describe("statusAfterPaymentRemoval", () => {
  it("reopens a completed order as invoiced when a payment removal leaves a balance", () => {
    expect(statusAfterPaymentRemoval("completed", 100_000, 40_000)).toBe("invoiced");
  });

  it("leaves other cases unchanged", () => {
    expect(statusAfterPaymentRemoval("completed", 100_000, 100_000)).toBeNull();
    expect(statusAfterPaymentRemoval("invoiced", 100_000, 0)).toBeNull();
  });
});
