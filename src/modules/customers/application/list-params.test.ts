import { describe, expect, it } from "vitest";
import { parseCustomerListParams } from "./list-params";

describe("parseCustomerListParams", () => {
  it("maps URL search params to a repository query", () => {
    expect(parseCustomerListParams({ q: "  apex ", status: "active", tier: "enterprise", sort: "sales_desc", page: "2" })).toEqual({
      search: "apex",
      status: "active",
      tier: "enterprise",
      sort: "sales_desc",
      page: 2,
      pageSize: 6,
    });
  });

  it("ignores unknown or malformed values instead of failing", () => {
    expect(parseCustomerListParams({ status: "vip", tier: ["enterprise", "project"], sort: "x", page: "-4" })).toEqual({
      search: undefined,
      status: undefined,
      tier: "enterprise",
      sort: "last_active",
      page: 1,
      pageSize: 6,
    });
  });
});
