import { describe, expect, it } from "vitest";
import {
  agingBucket,
  averageDaysToPay,
  computeInvoiceKpis,
  countInvoicesByTab,
  invoiceCsvRows,
  invoiceEmail,
  invoiceStatus,
  invoiceTabStatus,
  receivablesAging,
  reminderBlockedReason,
  type InvoiceFact,
} from "./invoice";

const now = new Date("2026-10-14T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const fact = (overrides: Partial<InvoiceFact>): InvoiceFact => ({
  status: "invoiced",
  amountCents: 100_000,
  paidCents: 0,
  issueDate: day("2026-10-01"),
  dueDate: day("2026-10-31"),
  paidAt: null,
  ...overrides,
});

describe("invoiceStatus", () => {
  it("is paid for completed orders, overdue past the due date, otherwise open", () => {
    expect(invoiceStatus(fact({ status: "completed" }), now)).toBe("paid");
    expect(invoiceStatus(fact({ dueDate: day("2026-10-13") }), now)).toBe("overdue");
    expect(invoiceStatus(fact({ dueDate: day("2026-10-14") }), now)).toBe("open");
    expect(invoiceStatus(fact({}), now)).toBe("open");
  });
});

describe("invoiceTabStatus", () => {
  it("maps list tabs to the effective order status used by the order list", () => {
    expect(invoiceTabStatus("all")).toBeUndefined();
    expect(invoiceTabStatus("open")).toBe("invoiced");
    expect(invoiceTabStatus("overdue")).toBe("overdue");
    expect(invoiceTabStatus("paid")).toBe("completed");
  });
});

describe("countInvoicesByTab", () => {
  it("counts every invoice once in all and once in its derived status", () => {
    const counts = countInvoicesByTab(
      [fact({}), fact({ dueDate: day("2026-09-01") }), fact({ status: "completed" }), fact({ status: "completed" })],
      now,
    );
    expect(counts).toEqual({ all: 4, open: 1, overdue: 1, paid: 2 });
  });
});

describe("averageDaysToPay", () => {
  it("averages issue-to-payment days of paid invoices, one decimal", () => {
    expect(
      averageDaysToPay([
        fact({ status: "completed", issueDate: day("2026-09-01"), paidAt: day("2026-09-11") }),
        fact({ status: "completed", issueDate: day("2026-09-01"), paidAt: day("2026-09-22") }),
        fact({}),
      ]),
    ).toBe(15.5);
  });

  it("is null when nothing has been paid", () => {
    expect(averageDaysToPay([fact({})])).toBeNull();
  });
});

describe("computeInvoiceKpis", () => {
  it("sums open balances, overdue balances and payments collected this calendar month", () => {
    const kpis = computeInvoiceKpis(
      [
        fact({ amountCents: 100_000, paidCents: 40_000 }),
        fact({ amountCents: 50_000, dueDate: day("2026-09-30") }),
        fact({ status: "completed", amountCents: 70_000, paidCents: 70_000, issueDate: day("2026-09-20"), paidAt: day("2026-10-02") }),
      ],
      [
        { amountCents: 40_000, paidAt: day("2026-10-05") },
        { amountCents: 70_000, paidAt: day("2026-10-02") },
        { amountCents: 99_000, paidAt: day("2026-09-29") },
      ],
      now,
    );
    expect(kpis).toEqual({
      outstandingCents: 110_000,
      openCount: 2,
      overdueCents: 50_000,
      overdueCount: 1,
      collectedCents: 110_000,
      collectedSince: day("2026-10-01"),
      averageDaysToPay: 12,
      paidCount: 1,
    });
  });
});

describe("agingBucket / receivablesAging", () => {
  it("buckets days overdue into current, 1-30, 31-60, 61-90 and 90+", () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91, 400].map(agingBucket)).toEqual([
      "current",
      "1_30",
      "1_30",
      "31_60",
      "31_60",
      "61_90",
      "61_90",
      "90_plus",
      "90_plus",
    ]);
  });

  it("ages open invoice balances as of now and ignores paid invoices", () => {
    const aging = receivablesAging(
      [
        fact({ amountCents: 10_000 }),
        fact({ amountCents: 20_000, paidCents: 5_000, dueDate: day("2026-10-04") }),
        fact({ amountCents: 30_000, dueDate: day("2026-08-01") }),
        fact({ amountCents: 40_000, dueDate: day("2026-01-01") }),
        fact({ status: "completed", amountCents: 50_000, paidCents: 50_000, dueDate: day("2026-01-01") }),
      ],
      now,
    );
    expect(aging.buckets.map((b) => [b.bucket, b.cents, b.count])).toEqual([
      ["current", 10_000, 1],
      ["1_30", 15_000, 1],
      ["31_60", 0, 0],
      ["61_90", 30_000, 1],
      ["90_plus", 40_000, 1],
    ]);
    expect(aging.totalCents).toBe(95_000);
  });
});

describe("reminderBlockedReason", () => {
  it("allows reminders only on unpaid invoices with a balance", () => {
    expect(reminderBlockedReason({ status: "invoiced", amountCents: 10, paidCents: 0 })).toBeNull();
    expect(reminderBlockedReason({ status: "completed", amountCents: 10, paidCents: 10 })).toMatch(/paid/i);
    expect(reminderBlockedReason({ status: "invoiced", amountCents: 10, paidCents: 10 })).toMatch(/balance/i);
  });
});

describe("invoiceEmail", () => {
  const base = {
    invoiceNumber: "INV-2047",
    company: "Hyperion <Media>",
    contactName: "Dana",
    issuer: "Northstar Studio",
    amountCents: 1_240_000,
    balanceCents: 1_000_000,
    issueDate: day("2026-10-10"),
    dueDate: day("2026-11-09"),
    link: "http://localhost:3000/invoices/INV-2047",
  };

  it("summarises the invoice with a link, escaping HTML", () => {
    const email = invoiceEmail({ ...base, kind: "invoice", daysOverdue: 0 });
    expect(email.subject).toBe("Invoice INV-2047 from Northstar Studio");
    expect(email.text).toContain("$12,400.00");
    expect(email.text).toContain("$10,000.00");
    expect(email.text).toContain("Nov 9, 2026");
    expect(email.text).toContain(base.link);
    expect(email.html).toContain("Hyperion &lt;Media&gt;");
    expect(email.html).not.toContain("<Media>");
  });

  it("words reminders by how overdue the invoice is", () => {
    expect(invoiceEmail({ ...base, kind: "reminder", daysOverdue: 5 }).subject).toBe("Reminder: invoice INV-2047 is 5 days overdue");
    expect(invoiceEmail({ ...base, kind: "reminder", daysOverdue: 0 }).subject).toBe("Reminder: invoice INV-2047 is due Nov 9, 2026");
  });
});

describe("invoiceCsvRows", () => {
  it("exports one row per invoice with derived status, money in dollars", () => {
    const rows = invoiceCsvRows(
      [
        {
          invoiceNumber: "INV-1",
          reference: "SL-1",
          customerCompany: "=Acme",
          status: "invoiced",
          amountCents: 12_345,
          paidCents: 2_345,
          issueDate: day("2026-10-01"),
          dueDate: day("2026-10-02"),
        },
      ],
      now,
    );
    expect(rows[0]).toEqual(["Invoice", "Order", "Client", "Issue Date", "Due Date", "Status", "Total (USD)", "Paid (USD)", "Balance (USD)"]);
    expect(rows[1]).toEqual(["INV-1", "SL-1", "=Acme", "2026-10-01", "2026-10-02", "Overdue", "123.45", "23.45", "100.00"]);
  });
});
