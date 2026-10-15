import { describe, expect, it } from "vitest";
import { activeFilterCount, dashboardFilterParams, parseDashboardParams } from "./params";

describe("parseDashboardParams", () => {
  it("defaults to this month's gross revenue", () => {
    expect(parseDashboardParams({})).toEqual({ period: "month", metric: "gross", filters: {} });
  });

  it("accepts known periods and metrics and ignores anything else", () => {
    expect(parseDashboardParams({ period: "quarter", metric: "collected" })).toEqual({ period: "quarter", metric: "collected", filters: {} });
    expect(parseDashboardParams({ period: ["year", "month"], metric: "net" })).toEqual({ period: "year", metric: "gross", filters: {} });
    expect(parseDashboardParams({ period: "decade" }).period).toBe("month");
  });
});

describe("dashboard filters", () => {
  it("reads category, customer and assignee filters", () => {
    expect(parseDashboardParams({ category: "cloud_architecture", customer: "4", assignee: "12" }).filters).toEqual({
      category: "cloud_architecture",
      customerId: 4,
      assigneeId: 12,
    });
  });

  it("drops unknown categories and non-numeric ids", () => {
    expect(parseDashboardParams({ category: "crypto", customer: "abc", assignee: "-1" }).filters).toEqual({});
    expect(parseDashboardParams({ customer: "0", assignee: "1e3" }).filters).toEqual({});
  });

  it("serializes active filters back to URL params", () => {
    expect(dashboardFilterParams({ category: "ux_ui_retainer", customerId: 3 })).toEqual({ category: "ux_ui_retainer", customer: 3, assignee: undefined });
    expect(activeFilterCount({ category: "ux_ui_retainer", assigneeId: 2 })).toBe(2);
    expect(activeFilterCount({})).toBe(0);
  });
});
