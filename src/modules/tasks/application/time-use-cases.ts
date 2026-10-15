import type { ActivityRepository } from "../../activity/application/ports";
import { NotFoundError, type Clock } from "../../shared-types";
import { formatDuration, hoursToMinutes, normalizeTimeNote, TimeEntryPermissionError } from "../domain/time-entry";
import type { TaskRepository, TaskTimeEntry, TaskTimeEntryRepository } from "./ports";

export interface TaskTimeDeps {
  tasks: TaskRepository;
  taskTimeEntries: TaskTimeEntryRepository;
  activity: ActivityRepository;
  clock: Clock;
}

export const makeListTimeEntries =
  ({ taskTimeEntries }: Pick<TaskTimeDeps, "taskTimeEntries">) =>
  (taskId: number) =>
    taskTimeEntries.listForTask(taskId);

/** "Log time": quarter-hour entries for the acting member; tracked hours are derived from them. */
export const makeLogTime =
  (deps: TaskTimeDeps) =>
  async (taskId: number, input: { hours: number; note: string | null }, actorId: number): Promise<TaskTimeEntry> => {
    const minutes = hoursToMinutes(input.hours);
    const now = deps.clock();
    if (!(await deps.tasks.findById(taskId))) throw new NotFoundError("Task", taskId);
    const entry = await deps.taskTimeEntries.create({ taskId, memberId: actorId, minutes, note: normalizeTimeNote(input.note), loggedAt: now });
    await deps.activity.record({ actorId, message: `logged ${formatDuration(minutes)}`, category: "operations", entityType: "task", entityId: taskId, createdAt: now });
    return entry;
  };

/** Members delete only the time they logged themselves. */
export const makeDeleteTimeEntry =
  (deps: TaskTimeDeps) =>
  async (id: number, actorId: number): Promise<void> => {
    const entry = await deps.taskTimeEntries.findById(id);
    if (!entry) throw new NotFoundError("Time entry", id);
    if (entry.memberId === null || entry.memberId !== actorId) throw new TimeEntryPermissionError();
    await deps.taskTimeEntries.delete(id);
    await deps.activity.record({
      actorId,
      message: `removed a ${formatDuration(entry.minutes)} time entry`,
      category: "operations",
      entityType: "task",
      entityId: entry.taskId,
      createdAt: deps.clock(),
    });
  };
