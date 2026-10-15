import { describe, expect, it } from "vitest";
import { formatDuration, hoursToMinutes, minutesToHours, normalizeTimeNote, TimeEntryRejectedError } from "./time-entry";

describe("hoursToMinutes", () => {
  it("accepts quarter-hour increments up to a full day", () => {
    expect(hoursToMinutes(1.5)).toBe(90);
    expect(hoursToMinutes(0.25)).toBe(15);
    expect(hoursToMinutes(24)).toBe(1440);
  });

  it("rejects zero, negative, oversized and fractional-minute amounts", () => {
    for (const hours of [0, -1, 24.25, 0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => hoursToMinutes(hours)).toThrow(TimeEntryRejectedError);
    }
  });
});

describe("time entry presentation", () => {
  it("trims notes and caps their length", () => {
    expect(normalizeTimeNote("  Wireframes  ")).toBe("Wireframes");
    expect(normalizeTimeNote("   ")).toBeNull();
    expect(normalizeTimeNote("x".repeat(300))).toHaveLength(200);
  });

  it("converts and formats durations", () => {
    expect(minutesToHours(840)).toBe(14);
    expect(minutesToHours(100)).toBe(1.67);
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(840)).toBe("14h");
  });
});
