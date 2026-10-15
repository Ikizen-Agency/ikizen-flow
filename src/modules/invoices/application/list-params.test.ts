import { describe, expect, it } from "vitest";
import { INVOICE_PAGE_SIZE, parseInvoiceListParams } from "./list-params";

describe("parseInvoiceListParams", () => {
  it("defaults to all invoices, page 1", () => {
    expect(parseInvoiceListParams({})).toEqual({ tab: "all", page: 1, pageSize: INVOICE_PAGE_SIZE });
  });

  it("reads tab, search, customer, inclusive date range and page", () => {
    const query = parseInvoiceListParams({ status: "overdue", q: "  INV-20 ", customerId: "7", from: "2026-09-01", to: "2026-09-30", page: "3" });
    expect(query).toEqual({
      tab: "overdue",
      search: "INV-20",
      customerId: 7,
      issuedFrom: new Date("2026-09-01T00:00:00Z"),
      issuedTo: new Date("2026-09-30T23:59:59.999Z"),
      page: 3,
      pageSize: INVOICE_PAGE_SIZE,
    });
  });

  it("ignores unknown tabs, bad ids and invalid dates", () => {
    expect(parseInvoiceListParams({ status: "cancelled", customerId: "-1", from: "2026-02-30", to: "yesterday", page: "x" })).toEqual({
      tab: "all",
      page: 1,
      pageSize: INVOICE_PAGE_SIZE,
    });
  });
});
