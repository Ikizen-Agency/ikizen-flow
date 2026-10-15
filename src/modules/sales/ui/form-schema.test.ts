import { describe, expect, it } from "vitest";
import { changeOrderStatusSchema, createOrderSchema, deletePaymentSchema, recordPaymentSchema, updateOrderSchema } from "./form-schema";

const items = JSON.stringify([
  { title: "Q4 UX Architecture & Prototyping Retainer", description: "Core flows", quantity: "1", unit: "unit", unitRate: "8,500.00" },
  { title: "Cloud Infrastructure CI/CD Migration", description: "", quantity: "40", unit: "hours", unitRate: "165" },
]);

const valid = {
  customerId: "1",
  category: "ux_ui_retainer",
  paymentTerms: "net_30",
  earlySettlement: "on",
  intent: "confirm",
  items,
};

describe("createOrderSchema", () => {
  it("parses the sale form into a create-order command", () => {
    const parsed = createOrderSchema.parse(valid);
    expect(parsed).toMatchObject({
      customerId: 1,
      category: "ux_ui_retainer",
      paymentTerms: "net_30",
      discountBps: 500,
      status: "pending",
      issueInvoice: true,
      title: "Q4 UX Architecture & Prototyping Retainer",
    });
    expect(parsed.items).toEqual([
      { title: "Q4 UX Architecture & Prototyping Retainer", description: "Core flows", quantity: 1, unit: "unit", unitRateCents: 850_000 },
      { title: "Cloud Infrastructure CI/CD Migration", description: null, quantity: 40, unit: "hours", unitRateCents: 16_500 },
    ]);
  });

  it("saves drafts without discount or invoice", () => {
    const parsed = createOrderSchema.parse({ ...valid, intent: "draft", earlySettlement: undefined });
    expect(parsed).toMatchObject({ status: "draft", issueInvoice: false, discountBps: 0 });
  });

  it("rejects missing customers, empty item lists and invalid lines", () => {
    expect(createOrderSchema.safeParse({ ...valid, customerId: "" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...valid, items: "[]" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...valid, items: "not json" }).success).toBe(false);
    const badLine = JSON.stringify([{ title: "", quantity: "0", unit: "unit", unitRate: "-5" }]);
    expect(createOrderSchema.safeParse({ ...valid, items: badLine }).success).toBe(false);
  });
});

describe("changeOrderStatusSchema", () => {
  it("accepts a reference and a stored status only", () => {
    expect(changeOrderStatusSchema.parse({ reference: "SL-1048", status: "completed" })).toEqual({ reference: "SL-1048", status: "completed" });
    expect(changeOrderStatusSchema.safeParse({ reference: "SL-1048", status: "overdue" }).success).toBe(false);
    expect(changeOrderStatusSchema.safeParse({ reference: "DROP TABLE", status: "completed" }).success).toBe(false);
  });
});

describe("updateOrderSchema", () => {
  it("parses the composer in edit mode for an existing reference", () => {
    const parsed = updateOrderSchema.parse({ ...valid, reference: "SL-1047" });
    expect(parsed.reference).toBe("SL-1047");
    expect(parsed.input).toMatchObject({ customerId: 1, category: "ux_ui_retainer", paymentTerms: "net_30", discountBps: 500 });
    expect(parsed.input.items).toHaveLength(2);
  });

  it("rejects an unknown reference", () => {
    expect(updateOrderSchema.safeParse({ ...valid, reference: "../x" }).success).toBe(false);
  });
});

describe("recordPaymentSchema", () => {
  it("converts dollars to cents and parses an optional payment date", () => {
    expect(recordPaymentSchema.parse({ reference: "SL-1040", amount: "1,250.50", method: "bank_transfer", paidOn: "2026-10-10", paymentReference: " WIRE-9 ", note: "" })).toEqual({
      reference: "SL-1040",
      amountCents: 125_050,
      method: "bank_transfer",
      paidAt: new Date("2026-10-10T12:00:00.000Z"),
      paymentReference: "WIRE-9",
      note: null,
    });
    expect(recordPaymentSchema.parse({ reference: "SL-1040", amount: "10", method: "cash" }).paidAt).toBeUndefined();
  });

  it("rejects zero amounts, unknown methods and malformed dates", () => {
    const result = recordPaymentSchema.safeParse({ reference: "SL-1040", amount: "0", method: "crypto", paidOn: "10/10/2026" });
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["amount", "method", "paidOn"]);
  });
});

describe("deletePaymentSchema", () => {
  it("requires a positive payment id", () => {
    expect(deletePaymentSchema.parse({ paymentId: "4" })).toEqual({ paymentId: 4 });
    expect(deletePaymentSchema.safeParse({ paymentId: "x" }).success).toBe(false);
  });
});
