import { describe, expect, it } from "vitest";
import { companyInitials, customerStatusTone, isEngaged } from "./customer";

describe("companyInitials", () => {
  it("uses the first letters of the first two significant words", () => {
    expect(companyInitials("Apex Digital Labs")).toBe("AD");
    expect(companyInitials("BlueWave Logistics AG")).toBe("BL");
    expect(companyInitials("Solas")).toBe("SO");
  });

  it("ignores leading articles", () => {
    expect(companyInitials("The Hyperion Media Group")).toBe("HM");
  });
});

describe("customer status", () => {
  it("maps statuses to semantic badge tones", () => {
    expect(customerStatusTone("active")).toBe("success");
    expect(customerStatusTone("pending_review")).toBe("warning");
    expect(customerStatusTone("inactive")).toBe("neutral");
    expect(customerStatusTone("archived")).toBe("neutral");
  });

  it("treats active and pending accounts as engaged", () => {
    expect(isEngaged("active")).toBe(true);
    expect(isEngaged("pending_review")).toBe(true);
    expect(isEngaged("inactive")).toBe(false);
  });
});
