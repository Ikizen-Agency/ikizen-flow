import { describe, expect, it } from "vitest";
import { companyInitials, customerHealthScore, customerStatusTone, isEngaged, retentionRate } from "./customer";

describe("companyInitials", () => {
  it("uses the first letters of the first two significant words", () => {
    expect(companyInitials("Apex Digital Labs")).toBe("AD");
    expect(companyInitials("BlueWave Logistics AG")).toBe("BL");
    expect(companyInitials("Solas")).toBe("SO");
  });

  it("ignores leading articles", () => {
    expect(companyInitials("The Hyperion Media Group")).toBe("HM");
  });
});

describe("customer status", () => {
  it("maps statuses to semantic badge tones", () => {
    expect(customerStatusTone("active")).toBe("success");
    expect(customerStatusTone("pending_review")).toBe("warning");
    expect(customerStatusTone("inactive")).toBe("neutral");
    expect(customerStatusTone("archived")).toBe("neutral");
  });

  it("treats active and pending accounts as engaged", () => {
    expect(isEngaged("active")).toBe(true);
    expect(isEngaged("pending_review")).toBe(true);
    expect(isEngaged("inactive")).toBe(false);
  });
});

describe("retentionRate", () => {
  it("is the share of non-archived accounts still engaged", () => {
    expect(retentionRate({ active: 9, pending_review: 1, inactive: 2, archived: 5 })).toBeCloseTo(10 / 12);
    expect(retentionRate({ active: 0, pending_review: 0, inactive: 0, archived: 3 })).toBe(0);
  });
});

describe("customerHealthScore", () => {
  it("scores an engaged, recently active account with no overdue work as healthy", () => {
    expect(customerHealthScore({ status: "active", daysSinceActivity: 0, overdueOrders: 0 })).toBe(100);
  });

  it("deducts for staleness, overdue receivables and disengaged status, clamped to 0..100", () => {
    expect(customerHealthScore({ status: "active", daysSinceActivity: 20, overdueOrders: 1 })).toBe(71);
    expect(customerHealthScore({ status: "pending_review", daysSinceActivity: 3, overdueOrders: 0 })).toBe(87);
    expect(customerHealthScore({ status: "archived", daysSinceActivity: 400, overdueOrders: 5 })).toBe(0);
    expect(customerHealthScore({ status: "active", daysSinceActivity: null, overdueOrders: 0 })).toBe(70);
  });
});
