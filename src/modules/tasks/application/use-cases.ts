import type { ActivityRepository } from "../../activity/application/ports";
import { NotFoundError, type Clock } from "../../shared-types";
import {
  applyTaskStatusChange,
  compareTasksForBoard,
  nextTaskCode,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskStatus,
} from "../domain/task";
import type { NewTask, Task, TaskBoardQuery, TaskRepository } from "./ports";

export interface TaskDeps {
  tasks: TaskRepository;
  activity: ActivityRepository;
  clock: Clock;
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
  ({ tasks, activity, clock }: TaskDeps) =>
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
    return task;
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

export const makeToggleSubtask =
  ({ tasks, clock }: Pick<TaskDeps, "tasks" | "clock">) =>
  async (taskId: number, subtaskId: number, done: boolean) => {
    const found = await tasks.setSubtaskDone(taskId, subtaskId, done, clock());
    if (!found) throw new NotFoundError("Subtask", subtaskId);
  };

export const makeAddSubtask =
  ({ tasks, clock }: Pick<TaskDeps, "tasks" | "clock">) =>
  async (taskId: number, title: string) => {
    if (!(await tasks.findById(taskId))) throw new NotFoundError("Task", taskId);
    await tasks.addSubtask(taskId, title, clock());
  };

/** Comments live in the activity log (shown in the task timeline) and bump the card's comment counter. */
export const makeCommentOnTask =
  ({ tasks, activity, clock }: TaskDeps) =>
  async (taskId: number, body: string, actorId: number | null = null) => {
    const now = clock();
    if (!(await tasks.findById(taskId))) throw new NotFoundError("Task", taskId);
    await tasks.incrementCommentCount(taskId, now);
    await activity.record({
      actorId,
      message: `commented: ${body}`,
      category: "operations",
      entityType: "task",
      entityId: taskId,
      createdAt: now,
    });
  };
