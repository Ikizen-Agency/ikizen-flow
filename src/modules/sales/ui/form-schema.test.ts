import { describe, expect, it } from "vitest";
import { changeOrderStatusSchema, createOrderSchema } from "./form-schema";

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
