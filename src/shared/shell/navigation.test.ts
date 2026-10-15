import { describe, expect, it } from "vitest";
import { isActive } from "./navigation";

describe("isActive", () => {
  it("matches the overview only on the root path", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/customers", "/")).toBe(false);
  });

  it("matches a section and its nested routes but not lookalike prefixes", () => {
    expect(isActive("/sales", "/sales")).toBe(true);
    expect(isActive("/sales/SL-1042", "/sales")).toBe(true);
    expect(isActive("/salesforce", "/sales")).toBe(false);
  });
});
