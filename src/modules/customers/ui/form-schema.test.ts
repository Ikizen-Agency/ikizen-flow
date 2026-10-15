import { describe, expect, it } from "vitest";
import { bulkCustomerSchema, createCustomerSchema, parseCustomerIds, updateCustomerSchema } from "./form-schema";

const valid = {
  company: " Acme Corporation ",
  tier: "enterprise",
  status: "active",
  industry: "Manufacturing",
  contactName: "Jane Doe",
  contactEmail: "jane@acme.com",
  initialAmount: "25,000",
};

describe("createCustomerSchema", () => {
  it("trims text and converts the initial engagement to cents", () => {
    const parsed = createCustomerSchema.parse(valid);
    expect(parsed.company).toBe("Acme Corporation");
    expect(parsed.initialAmountCents).toBe(2_500_000);
  });

  it("treats an empty initial engagement as none", () => {
    expect(createCustomerSchema.parse({ ...valid, initialAmount: "" }).initialAmountCents).toBeNull();
  });

  it("reports field errors for missing names, bad emails, archived status and invalid amounts", () => {
    const result = createCustomerSchema.safeParse({ ...valid, company: "", contactEmail: "nope", status: "archived", initialAmount: "abc" });
    expect(result.success).toBe(false);
    const fields = Object.keys(result.error!.flatten().fieldErrors).sort();
    expect(fields).toEqual(["company", "contactEmail", "initialAmount", "status"]);
  });
});

describe("updateCustomerSchema", () => {
  const edit = { id: "7", company: "Acme", tier: "retainer", status: "inactive", industry: "Retail", contactName: "Jane", contactEmail: "jane@acme.com", billingEmail: "", paymentTerms: "net_15" };

  it("parses every editable field and treats an empty billing email as none", () => {
    expect(updateCustomerSchema.parse(edit)).toEqual({
      id: 7,
      patch: { company: "Acme", tier: "retainer", status: "inactive", industry: "Retail", contactName: "Jane", contactEmail: "jane@acme.com", billingEmail: null, paymentTerms: "net_15" },
    });
  });

  it("rejects the archived status (archiving is a separate action) and address lists", () => {
    const result = updateCustomerSchema.safeParse({ ...edit, status: "archived", billingEmail: "a@b.com,c@d.com" });
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["billingEmail", "status"]);
  });
});

describe("bulk customer actions", () => {
  it("parses distinct positive ids and drops junk", () => {
    expect(parseCustomerIds(["3", "3", "x", "-1", "12"])).toEqual([3, 12]);
  });

  it("validates each operation's fields", () => {
    expect(bulkCustomerSchema.parse({ operation: "tier", ids: [1, 2], tier: "enterprise" })).toEqual({ operation: "tier", ids: [1, 2], tier: "enterprise" });
    expect(bulkCustomerSchema.parse({ operation: "campaign", ids: [1], subject: " Hello ", message: "Body" })).toMatchObject({ subject: "Hello" });
    expect(bulkCustomerSchema.safeParse({ operation: "campaign", ids: [1], subject: "Hi\nBcc: x", message: "Body" }).success).toBe(false);
    expect(bulkCustomerSchema.safeParse({ operation: "archive", ids: [] }).success).toBe(false);
    expect(bulkCustomerSchema.safeParse({ operation: "tier", ids: [1], tier: "gold" }).success).toBe(false);
  });
});
