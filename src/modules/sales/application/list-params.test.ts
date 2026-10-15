import { describe, expect, it } from "vitest";
import { parseOrderListParams } from "./list-params";

describe("parseOrderListParams", () => {
  it("maps URL params, including the derived overdue status", () => {
    expect(parseOrderListParams({ status: "overdue", q: " SL-104 ", customerId: "3", page: "2" }, { pageSize: 6 })).toEqual({
      status: "overdue",
      search: "SL-104",
      customerId: 3,
      page: 2,
      pageSize: 6,
    });
  });

  it("drops invalid values and only honours pageSize when allowed, clamped to the maximum", () => {
    expect(parseOrderListParams({ status: "paid", customerId: "x", pageSize: "500" }, { pageSize: 20, allowPageSize: true })).toEqual({
      status: undefined,
      search: undefined,
      customerId: undefined,
      page: 1,
      pageSize: 100,
    });
    expect(parseOrderListParams({ pageSize: "50" }, { pageSize: 6 }).pageSize).toBe(6);
  });
});
