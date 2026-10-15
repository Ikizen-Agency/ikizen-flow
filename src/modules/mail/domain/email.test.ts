import { describe, expect, it } from "vitest";
import { assertValidEmail, isSingleEmailAddress } from "./email";

const message = (to: string) => ({ to, subject: "Hello", text: "Body" });

describe("isSingleEmailAddress", () => {
  it("accepts one plain address", () => {
    expect(isSingleEmailAddress("ana@newco.io")).toBe(true);
    expect(isSingleEmailAddress("first.last+tag@sub.example.com")).toBe(true);
  });

  it.each([
    ["a@b,c"],
    ["a@b.com,c@d.com"],
    ["a@b.com;c@d.com"],
    ["a b@c.com"],
    ["a@b .com"],
    ["a@b.com\tc"],
    ["a@b.com\u0000"],
    ["a\u0007@b.com"],
    ["a@b.com\u007F"],
    ["<a@b.com>"],
    ["Name <a@b.com>"],
    ["a@b@c.com"],
    ["@b.com"],
    ["a@"],
    [""],
  ])("rejects %j", (value) => {
    expect(isSingleEmailAddress(value)).toBe(false);
  });
});

describe("assertValidEmail", () => {
  it("rejects a recipient list smuggled into one address", () => {
    expect(() => assertValidEmail(message("a@b,c"))).toThrow(/Invalid recipient/);
    expect(() => assertValidEmail(message("a@b.com;c@d.com"))).toThrow(/Invalid recipient/);
  });

  it("accepts a single valid recipient", () => {
    expect(() => assertValidEmail(message("ana@newco.io"))).not.toThrow();
  });
});
