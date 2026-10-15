/** Pure read-model rules for the tasks board: due labels, header counts and operational KPIs. */
import { ratio } from "@/shared/domain/stats";
import { addDays, daysBetween, startOfDay } from "@/shared/domain/time";
import { taskDueState, type TaskPriority, type TaskStatus } from "./task";

const MS_PER_HOUR = 3_600_000;

export type DueTone = "danger" | "warning" | "neutral" | "success";

export interface DueDescriptor {
  label: string;
  /** Material Symbols ligature. */
  icon: string;
  tone: DueTone;
}

interface DueFields {
  status: TaskStatus;
  dueAt: Date | null;
  completedAt: Date | null;
}

function formatters(timeZone?: string) {
  return {
    time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }),
    day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }),
  };
}

/**
 * Card/drawer due label: "Today, 5:00 PM", "Tomorrow", "Oct 28", "2 days overdue", "Completed yesterday".
 * `timeZone` only affects clock times and calendar labels (defaults to the runtime zone).
 */
export function describeTaskDue(task: DueFields, now: Date, timeZone?: string): DueDescriptor | null {
  const f = formatters(timeZone);
  if (task.status === "completed") {
    if (!task.completedAt) return { label: "Completed", icon: "event_available", tone: "success" };
    const days = daysBetween(task.completedAt, now);
    const when = days <= 0 ? "today" : days === 1 ? "yesterday" : f.day.format(task.completedAt);
    return { label: `Completed ${when}`, icon: "event_available", tone: "success" };
  }
  if (!task.dueAt) return null;
  switch (taskDueState(task, now)) {
    case "overdue": {
      const days = daysBetween(task.dueAt, now);
      const label = days <= 0 ? `Overdue, ${f.time.format(task.dueAt)}` : `${days} day${days === 1 ? "" : "s"} overdue`;
      return { label, icon: "warning", tone: "danger" };
    }
    case "today":
      return { label: `Today, ${f.time.format(task.dueAt)}`, icon: "alarm", tone: "danger" };
    case "tomorrow":
      return { label: "Tomorrow", icon: "schedule", tone: "warning" };
    default:
      return { label: f.day.format(task.dueAt), icon: "event", tone: "neutral" };
  }
}

interface BoardTask {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

const CRITICAL: ReadonlyArray<TaskPriority> = ["urgent", "high"];

/** Open work that is blocked, overdue or due today. */
export function needsAttention(task: Pick<BoardTask, "status" | "dueAt">, now: Date): boolean {
  if (task.status === "completed") return false;
  if (task.status === "blocked") return true;
  const state = taskDueState(task, now);
  return state === "overdue" || state === "today";
}

export interface BoardSummary {
  total: number;
  active: number;
  attention: number;
  criticalBlockers: number;
}

export function summarizeBoard(tasks: ReadonlyArray<Pick<BoardTask, "status" | "priority" | "dueAt">>, now: Date): BoardSummary {
  return {
    total: tasks.length,
    active: tasks.filter((t) => t.status !== "completed").length,
    attention: tasks.filter((t) => needsAttention(t, now)).length,
    criticalBlockers: tasks.filter((t) => t.status === "blocked" && CRITICAL.includes(t.priority)).length,
  };
}

export interface OperationalKpis {
  /** Completed share of all tasks (0..1). */
  completionRate: number;
  /** Tasks completed per week over the trailing four weeks. */
  velocityPerWeek: number;
  /** Whole hours blocked tasks have spent in their column (since their last update). */
  blockedHours: number;
  nextMilestone: { title: string; dueAt: Date } | null;
}

const VELOCITY_WEEKS = 4;

export function operationalKpis(tasks: ReadonlyArray<BoardTask>, now: Date): OperationalKpis {
  const windowStart = addDays(now, -7 * VELOCITY_WEEKS);
  const completed = tasks.filter((t) => t.status === "completed");
  const recent = completed.filter((t) => t.completedAt && t.completedAt >= windowStart && t.completedAt <= now);
  const blockedHours = tasks
    .filter((t) => t.status === "blocked")
    .reduce((sum, t) => sum + Math.max(0, Math.floor((now.getTime() - t.updatedAt.getTime()) / MS_PER_HOUR)), 0);

  const upcoming = tasks
    .filter((t): t is BoardTask & { dueAt: Date } => t.status !== "completed" && t.dueAt !== null && t.dueAt >= now)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const milestone = upcoming.find((t) => CRITICAL.includes(t.priority)) ?? upcoming[0];

  return {
    completionRate: ratio(completed.length, tasks.length),
    velocityPerWeek: recent.length / VELOCITY_WEEKS,
    blockedHours,
    nextMilestone: milestone ? { title: milestone.title, dueAt: milestone.dueAt } : null,
  };
}

export const DUE_FILTERS = ["overdue", "today", "7d", "30d"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  overdue: "Overdue",
  today: "Today",
  "7d": "Next 7 Days",
  "30d": "Next 30 Days",
};

export interface DueWindow {
  dueBefore?: Date;
  openOnly?: boolean;
}

const endOfDayPlus = (now: Date, days: number) => new Date(addDays(startOfDay(now), days + 1).getTime() - 1);

/** Storage filter for a "Due:" quick pick. Windows include overdue open work, never completed tasks. */
export function dueWindow(filter: DueFilter | undefined, now: Date): DueWindow {
  switch (filter) {
    case "overdue":
      return { dueBefore: now, openOnly: true };
    case "today":
      return { dueBefore: endOfDayPlus(now, 0), openOnly: true };
    case "7d":
      return { dueBefore: endOfDayPlus(now, 7), openOnly: true };
    case "30d":
      return { dueBefore: endOfDayPlus(now, 30), openOnly: true };
    default:
      return {};
  }
}

/** Optimistic board update: the moved task changes column, every other card keeps its identity. */
export function moveTaskInList<T extends { id: number; status: TaskStatus }>(tasks: ReadonlyArray<T>, id: number, status: TaskStatus): T[] {
  return tasks.map((t) => (t.id === id ? { ...t, status } : t));
}
