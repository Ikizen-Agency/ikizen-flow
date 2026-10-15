import { daysBetween } from "@/shared/domain/time";

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Kanban columns, in board order. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked / Pending",
  completed: "Completed",
};

export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type TaskDueState = "overdue" | "today" | "tomorrow" | "upcoming" | "none" | "done";

export function taskDueState(task: { status: TaskStatus; dueAt: Date | null }, now: Date): TaskDueState {
  if (task.status === "completed") return "done";
  if (!task.dueAt) return "none";
  if (task.dueAt.getTime() < now.getTime()) return "overdue";
  const days = daysBetween(now, task.dueAt);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return "upcoming";
}

interface StatusFields {
  status: TaskStatus;
  completedAt: Date | null;
  blockedReason: string | null;
}

/** Any column move is allowed; this keeps completion and blocker metadata consistent. */
export function applyTaskStatusChange(
  task: StatusFields,
  status: TaskStatus,
  now: Date,
  blockedReason?: string | null,
): StatusFields {
  return {
    status,
    completedAt: status === "completed" ? (task.status === "completed" ? task.completedAt : now) : null,
    blockedReason: status === "blocked" ? (blockedReason ?? task.blockedReason ?? null) : null,
  };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function compareTasksForBoard(
  a: { priority: TaskPriority; dueAt: Date | null },
  b: { priority: TaskPriority; dueAt: Date | null },
): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return aDue === bDue ? 0 : aDue < bDue ? -1 : 1;
}

export function subtaskProgress(subtasks: ReadonlyArray<{ done: boolean }>) {
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

const CODE_PREFIX = "TASK-";

export function nextTaskCode(latest: string | null): string {
  const n = latest ? Number(latest.replace(CODE_PREFIX, "")) : 100;
  return `${CODE_PREFIX}${(Number.isFinite(n) ? n : 100) + 1}`;
}
