/** Time tracking rules: entries are whole quarter hours, at most one day each. */

export const MAX_ENTRY_MINUTES = 24 * 60;
export const TIME_NOTE_MAX_LENGTH = 200;
const STEP_MINUTES = 15;

export class TimeEntryRejectedError extends Error {
  constructor(message = "Log between 0.25 and 24 hours, in quarter-hour steps.") {
    super(message);
    this.name = "TimeEntryRejectedError";
  }
}

export class TimeEntryPermissionError extends Error {
  constructor() {
    super("Only the person who logged this time can delete it.");
    this.name = "TimeEntryPermissionError";
  }
}

export function hoursToMinutes(hours: number): number {
  const minutes = hours * 60;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_ENTRY_MINUTES) throw new TimeEntryRejectedError();
  const rounded = Math.round(minutes);
  if (Math.abs(minutes - rounded) > 1e-6 || rounded % STEP_MINUTES !== 0) throw new TimeEntryRejectedError();
  return rounded;
}

export function normalizeTimeNote(note: string | null | undefined): string | null {
  const text = (note ?? "").replace(/\s+/g, " ").trim().slice(0, TIME_NOTE_MAX_LENGTH).trim();
  return text || null;
}

/** Hours with at most two decimals. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
