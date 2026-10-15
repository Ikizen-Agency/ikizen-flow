import { describe, expect, it } from "vitest";
import { createCustomerSchema } from "./form-schema";

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
