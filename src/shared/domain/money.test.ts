import { describe, expect, it } from "vitest";
import { applyBasisPoints, dollarsToCents, formatCompactMoney, formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats integer cents as USD with two decimals by default", () => {
    expect(formatMoney(2485000)).toBe("$24,850.00");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("can drop the fractional part for headline metrics", () => {
    expect(formatMoney(2485000, { decimals: false })).toBe("$24,850");
  });

  it("formats negative amounts with a leading minus", () => {
    expect(formatMoney(-75500)).toBe("-$755.00");
  });
});

describe("formatCompactMoney", () => {
  it("abbreviates thousands for chart axes and summaries", () => {
    expect(formatCompactMoney(6840000)).toBe("$68.4K");
    expect(formatCompactMoney(1800000)).toBe("$18K");
  });
});

describe("dollarsToCents", () => {
  it("converts decimal dollar amounts without floating point drift", () => {
    expect(dollarsToCents(8500)).toBe(850000);
    expect(dollarsToCents("165.00")).toBe(16500);
    expect(dollarsToCents("0.29")).toBe(29);
    expect(dollarsToCents("1,234.5")).toBe(123450);
  });

  it("rejects values that are not money", () => {
    expect(() => dollarsToCents("abc")).toThrow();
    expect(() => dollarsToCents(Number.NaN)).toThrow();
  });
});

describe("applyBasisPoints", () => {
  it("computes a percentage of an amount in cents, rounding half up", () => {
    expect(applyBasisPoints(1510000, 500)).toBe(75500); // 5% of $15,100
    expect(applyBasisPoints(333, 1000)).toBe(33);
    expect(applyBasisPoints(335, 1000)).toBe(34);
  });
});
