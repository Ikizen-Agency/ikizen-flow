import { describe, expect, it } from "vitest";
import { parseDashboardParams } from "./params";

describe("parseDashboardParams", () => {
  it("defaults to this month's gross revenue", () => {
    expect(parseDashboardParams({})).toEqual({ period: "month", metric: "gross" });
  });

  it("accepts known periods and metrics and ignores anything else", () => {
    expect(parseDashboardParams({ period: "quarter", metric: "collected" })).toEqual({ period: "quarter", metric: "collected" });
    expect(parseDashboardParams({ period: ["year", "month"], metric: "net" })).toEqual({ period: "year", metric: "gross" });
    expect(parseDashboardParams({ period: "decade" }).period).toBe("month");
  });
});
