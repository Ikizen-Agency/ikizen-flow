import type { QueryValue } from "@/shared/ui/href";
import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { DUE_FILTERS, type DueFilter } from "../domain/board";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "../domain/task";

export type TaskView = "kanban" | "list";

export interface TaskBoardParams {
  view: TaskView;
  assigneeId?: number;
  priority?: TaskPriority;
  /** Customer id, or "internal" for studio work without a client. */
  client?: number | "internal";
  due?: DueFilter;
  /** Task shown in the detail slide-over. */
  taskId?: number;
  create: boolean;
  /** Column preselected in the create form ("+" on a column header). */
  createStatus?: TaskStatus;
}

function oneOf<T extends string>(allowed: ReadonlyArray<T>, value: string | undefined): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function positiveInt(value: string | undefined): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Translates untrusted URL params into board state; unknown values are dropped. */
export function parseTaskBoardParams(params: SearchParamsRecord): TaskBoardParams {
  const client = firstParam(params.client);
  const result: TaskBoardParams = {
    view: firstParam(params.view) === "list" ? "list" : "kanban",
    assigneeId: positiveInt(firstParam(params.assignee)),
    priority: oneOf(TASK_PRIORITIES, firstParam(params.priority)),
    client: client === "internal" ? "internal" : positiveInt(client),
    due: oneOf(DUE_FILTERS, firstParam(params.due)),
    taskId: positiveInt(firstParam(params.task)),
    create: firstParam(params.create) === "1",
    createStatus: oneOf(TASK_STATUSES, firstParam(params.status)),
  };
  for (const key of Object.keys(result) as Array<keyof TaskBoardParams>) if (result[key] === undefined) delete result[key];
  return result;
}

/** URL params that define the current board (filters + view), used to build links that keep them. */
export function taskFilterQuery(p: TaskBoardParams): Record<string, QueryValue> {
  return {
    view: p.view === "list" ? "list" : undefined,
    assignee: p.assigneeId,
    priority: p.priority,
    client: p.client,
    due: p.due,
  };
}
