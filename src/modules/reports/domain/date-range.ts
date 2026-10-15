import { addDays, formatDate, parseIsoDate, startOfDay, startOfQuarter, toIsoDate } from "@/shared/domain/time";

export const REPORT_PRESETS = ["this_month", "last_month", "quarter", "ytd", "last_12_months", "custom"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export const DEFAULT_REPORT_PRESET: ReportPreset = "last_12_months";

export const REPORT_PRESET_LABELS: Record<ReportPreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  quarter: "This quarter",
  ytd: "Year to date",
  last_12_months: "Last 12 months",
  custom: "Custom range",
};

/** Half-open UTC range [start, end) plus the inclusive day inputs it was built from. */
export interface ReportRange {
  preset: ReportPreset;
  start: Date;
  end: Date;
  /** Inclusive `YYYY-MM-DD` bounds, for the date inputs and CSV file names. */
  fromInput: string;
  toInput: string;
  label: string;
}

export interface ReportRangeParams {
  preset?: string;
  from?: string;
  to?: string;
}

const MAX_SPAN_YEARS = 5;
const monthStart = (year: number, month: number) => new Date(Date.UTC(year, month, 1));

function build(preset: ReportPreset, start: Date, end: Date): ReportRange {
  const lastDay = addDays(end, -1);
  return {
    preset,
    start,
    end,
    fromInput: toIsoDate(start),
    toInput: toIsoDate(lastDay),
    label: `${REPORT_PRESET_LABELS[preset]} (${formatDate(start)} - ${formatDate(lastDay)})`,
  };
}

function presetRange(preset: Exclude<ReportPreset, "custom">, now: Date): ReportRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const tomorrow = addDays(startOfDay(now), 1);
  switch (preset) {
    case "this_month":
      return build(preset, monthStart(y, m), tomorrow);
    case "last_month":
      return build(preset, monthStart(y, m - 1), monthStart(y, m));
    case "quarter":
      return build(preset, startOfQuarter(now), tomorrow);
    case "ytd":
      return build(preset, monthStart(y, 0), tomorrow);
    case "last_12_months":
      return build(preset, monthStart(y, m - 11), tomorrow);
  }
}

/**
 * Untrusted URL params to a report range. `from` / `to` (inclusive days) select a custom range; reversed bounds
 * are swapped and spans are capped at five years. Unknown presets or invalid dates fall back to the default.
 */
export function resolveReportRange(params: ReportRangeParams, now: Date): ReportRange {
  const preset = REPORT_PRESETS.includes(params.preset as ReportPreset) ? (params.preset as ReportPreset) : undefined;
  const wantsCustom = preset === "custom" || (!preset && (params.from || params.to));
  if (wantsCustom) {
    const from = parseIsoDate(params.from);
    const to = parseIsoDate(params.to);
    if (from && to) {
      const [first, last] = from <= to ? [from, to] : [to, from];
      const end = addDays(last, 1);
      const floor = new Date(Date.UTC(end.getUTCFullYear() - MAX_SPAN_YEARS, end.getUTCMonth(), end.getUTCDate()));
      return build("custom", first < floor ? floor : first, end);
    }
    return presetRange(DEFAULT_REPORT_PRESET as Exclude<ReportPreset, "custom">, now);
  }
  return presetRange((preset ?? DEFAULT_REPORT_PRESET) as Exclude<ReportPreset, "custom">, now);
}

/** URL params that reproduce a range: the preset alone, or `preset=custom` with inclusive from / to days. */
export function reportRangeUrlParams(range: ReportRange): { preset: ReportPreset; from?: string; to?: string } {
  return range.preset === "custom" ? { preset: "custom", from: range.fromInput, to: range.toInput } : { preset: range.preset };
}
