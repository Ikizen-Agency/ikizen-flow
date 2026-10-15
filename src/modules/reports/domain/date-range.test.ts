import { describe, expect, it } from "vitest";
import { DEFAULT_REPORT_PRESET, reportRangeUrlParams, resolveReportRange } from "./date-range";

const now = new Date("2026-10-14T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("resolveReportRange", () => {
  it("resolves presets to half-open UTC ranges ending tomorrow (to date) or at a month boundary", () => {
    const expectations = {
      this_month: ["2026-10-01", "2026-10-15"],
      last_month: ["2026-09-01", "2026-10-01"],
      quarter: ["2026-10-01", "2026-10-15"],
      ytd: ["2026-01-01", "2026-10-15"],
      last_12_months: ["2025-11-01", "2026-10-15"],
    } as const;
    for (const [preset, [start, end]] of Object.entries(expectations)) {
      const range = resolveReportRange({ preset }, now);
      expect(range.preset).toBe(preset);
      expect(range.start).toEqual(day(start));
      expect(range.end).toEqual(day(end));
    }
  });

  it("exposes inclusive from/to inputs and a readable label", () => {
    const range = resolveReportRange({ preset: "last_month" }, now);
    expect(range.fromInput).toBe("2026-09-01");
    expect(range.toInput).toBe("2026-09-30");
    expect(range.label).toBe("Last month (Sep 1, 2026 - Sep 30, 2026)");
  });

  it("uses custom from/to (inclusive) and swaps them when reversed", () => {
    const range = resolveReportRange({ from: "2026-08-10", to: "2026-08-20" }, now);
    expect(range.preset).toBe("custom");
    expect(range.start).toEqual(day("2026-08-10"));
    expect(range.end).toEqual(day("2026-08-21"));
    const swapped = resolveReportRange({ preset: "custom", from: "2026-08-20", to: "2026-08-10" }, now);
    expect(swapped.start).toEqual(day("2026-08-10"));
    expect(swapped.end).toEqual(day("2026-08-21"));
  });

  it("falls back to the default preset on unknown presets or invalid custom dates", () => {
    expect(DEFAULT_REPORT_PRESET).toBe("last_12_months");
    expect(resolveReportRange({}, now).preset).toBe("last_12_months");
    expect(resolveReportRange({ preset: "forever" }, now).preset).toBe("last_12_months");
    expect(resolveReportRange({ preset: "custom", from: "2026-02-30", to: "2026-03-01" }, now).preset).toBe("last_12_months");
  });

  it("caps custom ranges at five years", () => {
    const range = resolveReportRange({ from: "2001-01-01", to: "2026-01-01" }, now);
    expect(range.start).toEqual(day("2021-01-02"));
  });
});

describe("reportRangeUrlParams", () => {
  it("keeps presets as a preset and custom ranges as from/to", () => {
    expect(reportRangeUrlParams(resolveReportRange({ preset: "ytd" }, now))).toEqual({ preset: "ytd" });
    expect(reportRangeUrlParams(resolveReportRange({ from: "2026-08-10", to: "2026-08-20" }, now))).toEqual({ preset: "custom", from: "2026-08-10", to: "2026-08-20" });
  });
});
