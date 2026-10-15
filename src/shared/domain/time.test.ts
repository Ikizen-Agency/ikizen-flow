import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, formatLastActivity, formatRelativeTime, startOfDay, startOfQuarter } from "./time";

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

describe("startOfQuarter", () => {
  it("returns the first UTC day of the calendar quarter", () => {
    expect(startOfQuarter(now).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(startOfQuarter(new Date("2026-03-31T23:59:00Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(startOfQuarter(new Date("2026-05-02T08:00:00Z")).toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("formatLastActivity", () => {
  it("uses relative wording for today and yesterday, then a short date", () => {
    expect(formatLastActivity(new Date("2026-10-14T10:00:00Z"), now)).toBe("2 hours ago");
    expect(formatLastActivity(new Date("2026-10-14T11:59:30Z"), now)).toBe("just now");
    expect(formatLastActivity(new Date("2026-10-13T09:00:00Z"), now)).toBe("Yesterday");
    expect(formatLastActivity(new Date("2026-10-08T09:00:00Z"), now)).toBe("Oct 8");
  });

  it("adds the year for dates outside the current year and handles missing values", () => {
    expect(formatLastActivity(new Date("2025-12-30T09:00:00Z"), now)).toBe("Dec 30, 2025");
    expect(formatLastActivity(null, now)).toBe("Never");
  });
});

describe("formatDate", () => {
  it("formats a UTC calendar date like the design (Oct 24, 2024)", () => {
    expect(formatDate(new Date("2024-10-24T23:30:00Z"))).toBe("Oct 24, 2024");
  });
});
