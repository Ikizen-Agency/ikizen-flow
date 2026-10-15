import type { ActivityRepository } from "../../activity/application/ports";
import type { Notify } from "../../notifications/application/use-cases";
import { NotFoundError, type Clock } from "../../shared-types";
import { assertCommentAuthor, newMentions, normalizeCommentBody, parseMentions, plainCommentText } from "../domain/comment";
import type { Task, TaskComment, TaskCommentRepository, TaskRepository } from "./ports";

export interface TaskCommentDeps {
  tasks: TaskRepository;
  taskComments: TaskCommentRepository;
  activity: ActivityRepository;
  clock: Clock;
  /** Optional: in-app notifications (mentions). */
  notify?: Notify;
}

const PREVIEW_LENGTH = 140;

/** One "mention" notification per newly mentioned member; `notify` drops the author and non-members. */
function notifyMentions({ notify }: Pick<TaskCommentDeps, "notify">, task: Task, recipientIds: number[], body: string, actorId: number) {
  if (recipientIds.length === 0) return;
  return notify?.({
    recipientIds,
    actorId,
    type: "mention",
    title: `You were mentioned on ${task.code}`,
    body: plainCommentText(body).slice(0, PREVIEW_LENGTH),
    href: `/tasks?task=${task.id}`,
  });
}

async function ownComment({ taskComments }: Pick<TaskCommentDeps, "taskComments">, id: number, actorId: number): Promise<TaskComment> {
  const comment = await taskComments.findById(id);
  if (!comment) throw new NotFoundError("Comment", id);
  assertCommentAuthor(comment, actorId);
  return comment;
}

export const makeListTaskComments =
  ({ taskComments }: Pick<TaskCommentDeps, "taskComments">) =>
  (taskId: number) =>
    taskComments.listForTask(taskId);

export const makeAddTaskComment =
  (deps: TaskCommentDeps) =>
  async (taskId: number, rawBody: string, actorId: number): Promise<TaskComment> => {
    const body = normalizeCommentBody(rawBody);
    const now = deps.clock();
    const task = await deps.tasks.findById(taskId);
    if (!task) throw new NotFoundError("Task", taskId);
    const comment = await deps.taskComments.create({ taskId, authorId: actorId, body }, now);
    await deps.activity.record({ actorId, message: `commented on ${task.title}`, category: "operations", entityType: "task", entityId: taskId, createdAt: now });
    await notifyMentions(deps, task, parseMentions(body), body, actorId);
    return comment;
  };

/** Authors only; members mentioned for the first time by the edit are notified. */
export const makeEditTaskComment =
  (deps: TaskCommentDeps) =>
  async (id: number, rawBody: string, actorId: number): Promise<TaskComment> => {
    const body = normalizeCommentBody(rawBody);
    const comment = await ownComment(deps, id, actorId);
    const now = deps.clock();
    await deps.taskComments.update(id, body, now);
    const task = await deps.tasks.findById(comment.taskId);
    if (task) {
      await deps.activity.record({ actorId, message: `edited a comment on ${task.title}`, category: "operations", entityType: "task", entityId: task.id, createdAt: now });
      await notifyMentions(deps, task, newMentions(comment.body, body), body, actorId);
    }
    return (await deps.taskComments.findById(id))!;
  };

export const makeDeleteTaskComment =
  (deps: TaskCommentDeps) =>
  async (id: number, actorId: number): Promise<void> => {
    const comment = await ownComment(deps, id, actorId);
    await deps.taskComments.delete(id);
    await deps.activity.record({
      actorId,
      message: "deleted a comment",
      category: "operations",
      entityType: "task",
      entityId: comment.taskId,
      createdAt: deps.clock(),
    });
  };
