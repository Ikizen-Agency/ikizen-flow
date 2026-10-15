import { describe, expect, it } from "vitest";
import { invoiceNumberSchema, issueInvoiceSchema, outboxResultMessage } from "./form-schema";

describe("invoice action schemas", () => {
  it("accepts invoice numbers and order references, trimming whitespace", () => {
    expect(invoiceNumberSchema.parse({ invoiceNumber: " INV-2047 " })).toEqual({ invoiceNumber: "INV-2047" });
    expect(issueInvoiceSchema.parse({ reference: "SL-1046" })).toEqual({ reference: "SL-1046" });
  });

  it("rejects malformed values", () => {
    expect(invoiceNumberSchema.safeParse({ invoiceNumber: "" }).success).toBe(false);
    expect(invoiceNumberSchema.safeParse({ invoiceNumber: "INV-1\nBcc: x" }).success).toBe(false);
    expect(issueInvoiceSchema.safeParse({ reference: "INV-1" }).success).toBe(false);
  });
});

describe("outboxResultMessage", () => {
  it("explains each delivery outcome", () => {
    expect(outboxResultMessage("Invoice", { status: "sent", error: null }, "a@b.co")).toEqual({ status: "success", message: "Invoice emailed to a@b.co." });
    expect(outboxResultMessage("Reminder", { status: "logged", error: null }, "a@b.co")).toEqual({
      status: "success",
      message: "Reminder recorded in the outbox for a@b.co (SMTP is not configured, so it was not delivered).",
    });
    expect(outboxResultMessage("Invoice", { status: "failed", error: "SMTP down" }, "a@b.co")).toEqual({
      status: "error",
      message: "Delivery of the invoice to a@b.co failed: SMTP down. The attempt is recorded in the outbox.",
    });
  });
});
