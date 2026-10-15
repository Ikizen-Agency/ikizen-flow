import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatRelativeTime, startOfDay } from "./time";

const now = new Date("2026-10-14T12:00:00Z");

describe("formatRelativeTime", () => {
  it("describes recent events in minutes and hours", () => {
    expect(formatRelativeTime(new Date("2026-10-14T11:59:40Z"), now)).toBe("just now");
    expect(formatRelativeTime(new Date("2026-10-14T11:42:00Z"), now)).toBe("18 minutes ago");
    expect(formatRelativeTime(new Date("2026-10-14T11:00:00Z"), now)).toBe("1 hour ago");
    expect(formatRelativeTime(new Date("2026-10-14T07:00:00Z"), now)).toBe("5 hours ago");
  });

  it("describes older events in days", () => {
    expect(formatRelativeTime(new Date("2026-10-13T10:00:00Z"), now)).toBe("yesterday");
    expect(formatRelativeTime(new Date("2026-10-10T10:00:00Z"), now)).toBe("4 days ago");
  });
});

describe("daysBetween", () => {
  it("counts whole calendar days ignoring the time of day", () => {
    expect(daysBetween(new Date("2026-10-02T23:00:00Z"), new Date("2026-10-14T01:00:00Z"))).toBe(12);
    expect(daysBetween(new Date("2026-10-14T01:00:00Z"), new Date("2026-10-14T23:00:00Z"))).toBe(0);
    expect(daysBetween(new Date("2026-10-15T00:00:00Z"), new Date("2026-10-14T00:00:00Z"))).toBe(-1);
  });
});

describe("addDays / startOfDay", () => {
  it("shifts dates by whole days and truncates to UTC midnight", () => {
    expect(addDays(new Date("2026-10-31T10:00:00Z"), 30).toISOString()).toBe("2026-11-30T10:00:00.000Z");
    expect(startOfDay(new Date("2026-10-14T17:45:00Z")).toISOString()).toBe("2026-10-14T00:00:00.000Z");
  });
});
