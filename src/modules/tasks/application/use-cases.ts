import type { ActivityRepository } from "../../activity/application/ports";
import type { Notify } from "../../notifications/application/use-cases";
import { NotFoundError, type Clock } from "../../shared-types";
import {
  applyTaskStatusChange,
  compareTasksForBoard,
  duplicateTaskTitle,
  nextTaskCode,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "../domain/task";
import type { NewTask, Task, TaskBoardQuery, TaskRepository } from "./ports";

export interface TaskDeps {
  tasks: TaskRepository;
  activity: ActivityRepository;
  clock: Clock;
  /** Optional: in-app notifications (assignment). */
  notify?: Notify;
}

export type TaskBoard = Record<TaskStatus, Task[]>;

export const makeGetTaskBoard =
  ({ tasks }: Pick<TaskDeps, "tasks">) =>
  async (query: TaskBoardQuery = {}): Promise<TaskBoard> => {
    const all = await tasks.listBoard(query);
    const board = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as TaskBoard;
    for (const task of all) board[task.status].push(task);
    for (const status of TASK_STATUSES) board[status].sort(compareTasksForBoard);
    return board;
  };

export type CreateTaskInput = Omit<NewTask, "code">;

export const makeCreateTask =
  ({ tasks, activity, clock, notify }: TaskDeps) =>
  async (input: CreateTaskInput, actorId: number | null = null) => {
    const now = clock();
    const task = await tasks.create({ ...input, code: nextTaskCode(await tasks.latestCode()) }, now);
    await activity.record({
      actorId,
      message: `created task ${task.title}`,
      category: "operations",
      entityType: "task",
      entityId: task.id,
      createdAt: now,
    });
    await notify?.({
      recipientIds: [task.assigneeId],
      actorId,
      type: "task_assigned",
      title: `You were assigned ${task.code}`,
      body: task.title,
      href: `/tasks?task=${task.id}`,
    });
    return task;
  };

export interface UpdateTaskInput {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  customerId: number | null;
  assigneeId: number | null;
  dueAt: Date | null;
  estimateHours: number | null;
  tags: string[];
  /** Required when `status` is blocked; ignored otherwise. */
  blockedReason: string | null;
}

export class TaskNotBlockedError extends Error {
  constructor() {
    super("This task is not blocked. Move it to Blocked to record a reason.");
    this.name = "TaskNotBlockedError";
  }
}

const sameTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Human summary of what an edit changed, for the activity log. */
function describeChanges(before: Task, after: UpdateTaskInput): string[] {
  const changed: string[] = [];
  if (before.title !== after.title) changed.push("title");
  if ((before.description ?? null) !== after.description) changed.push("description");
  if (before.status !== after.status) changed.push(`status to ${TASK_STATUS_LABELS[after.status]}`);
  if (before.priority !== after.priority) changed.push(`priority to ${TASK_PRIORITY_LABELS[after.priority]}`);
  if (before.customerId !== after.customerId) changed.push("client");
  if (before.assigneeId !== after.assigneeId) changed.push("assignee");
  if (!sameTime(before.dueAt, after.dueAt)) changed.push("due date");
  if (before.estimateHours !== after.estimateHours) changed.push("estimate");
  if (before.tags.join("|") !== after.tags.join("|")) changed.push("tags");
  return changed;
}

/** Edit dialog: every field at once. Reassigning notifies the new assignee (unless they made the change). */
export const makeUpdateTask =
  ({ tasks, activity, clock, notify }: TaskDeps) =>
  async (id: number, input: UpdateTaskInput, actorId: number | null = null): Promise<Task> => {
    const now = clock();
    const task = await tasks.findById(id);
    if (!task) throw new NotFoundError("Task", id);
    const statusFields = applyTaskStatusChange(task, input.status, now, input.status === "blocked" ? input.blockedReason : undefined);
    await tasks.update(id, { ...input, ...statusFields, updatedAt: now });
    const changed = describeChanges(task, input);
    if (task.blockedReason !== statusFields.blockedReason && statusFields.blockedReason) changed.push("blocked reason");
    await activity.record({
      actorId,
      message: `updated task ${input.title}${changed.length ? ` (${changed.join(", ")})` : ""}`,
      category: "operations",
      entityType: "task",
      entityId: id,
      createdAt: now,
    });
    if (input.assigneeId !== null && input.assigneeId !== task.assigneeId) {
      await notify?.({
        recipientIds: [input.assigneeId],
        actorId,
        type: "task_assigned",
        title: `You were assigned ${task.code}`,
        body: input.title,
        href: `/tasks?task=${id}`,
      });
    }
    return (await tasks.findById(id))!;
  };

/** Changes the explanation of a blocked task (drawer quick edit). */
export const makeSetBlockedReason =
  ({ tasks, activity, clock }: Pick<TaskDeps, "tasks" | "activity" | "clock">) =>
  async (id: number, reason: string, actorId: number | null = null) => {
    const now = clock();
    const task = await tasks.findById(id);
    if (!task) throw new NotFoundError("Task", id);
    if (task.status !== "blocked") throw new TaskNotBlockedError();
    const next = applyTaskStatusChange(task, "blocked", now, reason);
    await tasks.update(id, { blockedReason: next.blockedReason, updatedAt: now });
    await activity.record({
      actorId,
      message: `set the blocker of ${task.title}: ${next.blockedReason}`,
      category: "operations",
      entityType: "task",
      entityId: id,
      createdAt: now,
    });
  };

export const makeDeleteTask =
  ({ tasks, activity, clock }: Pick<TaskDeps, "tasks" | "activity" | "clock">) =>
  async (id: number, actorId: number | null = null) => {
    const task = await tasks.findById(id);
    if (!task || !(await tasks.delete(id))) throw new NotFoundError("Task", id);
    await activity.record({ actorId, message: `deleted task ${task.code} ${task.title}`, category: "operations", createdAt: clock() });
    return task;
  };

/** Copies a task (fields, tags and checklist titles) into a new To Do task with the next code. */
export const makeDuplicateTask =
  ({ tasks, activity, clock }: Pick<TaskDeps, "tasks" | "activity" | "clock">) =>
  async (id: number, actorId: number | null = null): Promise<Task> => {
    const now = clock();
    const source = await tasks.findById(id);
    if (!source) throw new NotFoundError("Task", id);
    const copy = await tasks.create(
      {
        code: nextTaskCode(await tasks.latestCode()),
        title: duplicateTaskTitle(source.title),
        description: source.description,
        status: "todo",
        priority: source.priority,
        customerId: source.customerId,
        assigneeId: source.assigneeId,
        dueAt: source.dueAt,
        estimateHours: source.estimateHours,
        tags: source.tags,
        subtasks: source.subtasks.map((s) => s.title),
      },
      now,
    );
    await activity.record({
      actorId,
      message: `duplicated ${source.code} as ${copy.code}`,
      category: "operations",
      entityType: "task",
      entityId: copy.id,
      createdAt: now,
    });
    return copy;
  };

export const makeMoveTask =
  ({ tasks, activity, clock }: TaskDeps) =>
  async (id: number, status: TaskStatus, options: { blockedReason?: string | null; actorId?: number | null } = {}) => {
    const now = clock();
    const task = await tasks.findById(id);
    if (!task) throw new NotFoundError("Task", id);
    if (task.status === status) return;
    const next = applyTaskStatusChange(task, status, now, options.blockedReason);
    await tasks.updateStatus(id, { ...next, updatedAt: now });
    await activity.record({
      actorId: options.actorId ?? null,
      message: status === "completed" ? `completed ${task.title}` : `moved ${task.title} to ${TASK_STATUS_LABELS[status]}`,
      category: "development",
      entityType: "task",
      entityId: id,
      createdAt: now,
    });
  };

const TIMELINE_LIMIT = 20;

/** Slide-over detail: the task with its subtasks plus its activity timeline (newest first). */
export const makeGetTaskDetail =
  ({ tasks, activity }: Pick<TaskDeps, "tasks" | "activity">) =>
  async (id: number) => {
    const task = await tasks.findById(id);
    if (!task) return null;
    return { task, activity: await activity.forEntity("task", id, TIMELINE_LIMIT) };
  };

type SubtaskDeps = Pick<TaskDeps, "tasks" | "activity" | "clock">;

function recordSubtaskEvent({ activity }: Pick<TaskDeps, "activity">, taskId: number, message: string, actorId: number | null, now: Date) {
  return activity.record({ actorId, message, category: "operations", entityType: "task", entityId: taskId, createdAt: now });
}

export const makeToggleSubtask =
  (deps: SubtaskDeps) =>
  async (taskId: number, subtaskId: number, done: boolean, actorId: number | null = null) => {
    const now = deps.clock();
    const found = await deps.tasks.setSubtaskDone(taskId, subtaskId, done, now);
    if (!found) throw new NotFoundError("Subtask", subtaskId);
    const title = (await deps.tasks.findById(taskId))?.subtasks.find((s) => s.id === subtaskId)?.title ?? "a checklist item";
    await recordSubtaskEvent(deps, taskId, `${done ? "checked off" : "reopened"} ${title}`, actorId, now);
  };

export const makeAddSubtask =
  (deps: SubtaskDeps) =>
  async (taskId: number, title: string, actorId: number | null = null) => {
    const now = deps.clock();
    if (!(await deps.tasks.findById(taskId))) throw new NotFoundError("Task", taskId);
    await deps.tasks.addSubtask(taskId, title, now);
    await recordSubtaskEvent(deps, taskId, `added checklist item ${title}`, actorId, now);
  };

export const makeRenameSubtask =
  (deps: SubtaskDeps) =>
  async (taskId: number, subtaskId: number, title: string, actorId: number | null = null) => {
    const now = deps.clock();
    if (!(await deps.tasks.renameSubtask(taskId, subtaskId, title, now))) throw new NotFoundError("Subtask", subtaskId);
    await recordSubtaskEvent(deps, taskId, `renamed a checklist item to ${title}`, actorId, now);
  };

export const makeDeleteSubtask =
  (deps: SubtaskDeps) =>
  async (taskId: number, subtaskId: number, actorId: number | null = null) => {
    const now = deps.clock();
    const title = (await deps.tasks.findById(taskId))?.subtasks.find((s) => s.id === subtaskId)?.title;
    if (!(await deps.tasks.deleteSubtask(taskId, subtaskId, now))) throw new NotFoundError("Subtask", subtaskId);
    await recordSubtaskEvent(deps, taskId, `removed checklist item ${title ?? ""}`.trim(), actorId, now);
  };
