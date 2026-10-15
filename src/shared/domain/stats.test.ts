import { describe, expect, it } from "vitest";
import { formatPercent, percentChange, ratio } from "./stats";

describe("percentChange", () => {
  it("returns the relative change between two periods", () => {
    expect(percentChange(118, 100)).toBeCloseTo(0.18);
    expect(percentChange(50, 100)).toBeCloseTo(-0.5);
  });

  it("is undefined when there is no baseline", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe("ratio", () => {
  it("divides safely", () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(3, 0)).toBe(0);
  });
});

describe("formatPercent", () => {
  it("formats fractions with one decimal and an optional sign", () => {
    expect(formatPercent(0.184)).toBe("18.4%");
    expect(formatPercent(0.982)).toBe("98.2%");
    expect(formatPercent(0.042, { signed: true })).toBe("+4.2%");
    expect(formatPercent(-0.1, { signed: true })).toBe("-10.0%");
  });
});
