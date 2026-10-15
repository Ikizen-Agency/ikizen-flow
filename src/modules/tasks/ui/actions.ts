"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceApp } from "@/server/request-context";
import { NotFoundError } from "../../shared-types";
import { TaskNotBlockedError } from "../application/use-cases";
import { AttachmentRejectedError, MAX_ATTACHMENT_BYTES } from "../domain/attachment";
import { CommentPermissionError, CommentRejectedError } from "../domain/comment";
import { TimeEntryPermissionError, TimeEntryRejectedError } from "../domain/time-entry";
import { BlockedReasonRequiredError, type TaskStatus } from "../domain/task";
import {
  addSubtaskSchema,
  attachmentIdSchema,
  blockedReasonSchema,
  commentIdSchema,
  createTaskSchema,
  deleteSubtaskSchema,
  editCommentSchema,
  logTimeSchema,
  moveTaskSchema,
  renameSubtaskSchema,
  taskCommentSchema,
  taskIdSchema,
  timeEntryIdSchema,
  toggleSubtaskSchema,
  updateTaskSchema,
  type CreateTaskState,
  type TaskMutationResult,
  type UpdateTaskState,
} from "./form-schema";

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/");
}

function textEntries(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  return values;
}

/** Domain errors carry user-facing messages; anything else is logged and reported generically. */
function failure(error: unknown, action: string): TaskMutationResult {
  if (
    error instanceof NotFoundError ||
    error instanceof BlockedReasonRequiredError ||
    error instanceof TaskNotBlockedError ||
    error instanceof CommentRejectedError ||
    error instanceof CommentPermissionError ||
    error instanceof AttachmentRejectedError ||
    error instanceof TimeEntryRejectedError ||
    error instanceof TimeEntryPermissionError
  ) {
    return { ok: false, message: error.message };
  }
  console.error(`${action} failed`, error);
  return { ok: false, message: "The change could not be saved. Please try again." };
}

/** "Create Task" form: validates, creates the task with its subtasks, then opens it. */
export async function createTaskAction(_prev: CreateTaskState, formData: FormData): Promise<CreateTaskState> {
  const { ctx, app } = await getWorkspaceApp();
  const values = textEntries(formData);
  const parsed = createTaskSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  let id: number;
  try {
    id = (await app.tasks.create(parsed.data, ctx.member.id)).id;
  } catch (error) {
    console.error("createTaskAction failed", error);
    return { status: "error", message: "The task could not be saved. Please try again.", values };
  }
  revalidateTasks();
  redirect(`/tasks?task=${id}`);
}

/** "Edit Task" dialog: saves every field (reassignment notifies the new assignee), then reopens the task. */
export async function updateTaskAction(_prev: UpdateTaskState, formData: FormData): Promise<UpdateTaskState> {
  const { ctx, app } = await getWorkspaceApp();
  const values = textEntries(formData);
  const parsed = updateTaskSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  const { taskId, ...input } = parsed.data;
  try {
    await app.tasks.update(taskId, input, ctx.member.id);
  } catch (error) {
    return { status: "error", message: failure(error, "updateTaskAction").message, values };
  }
  revalidateTasks();
  redirect(`/tasks?task=${taskId}`);
}

export async function deleteTaskAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = taskIdSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid task." };
  try {
    await app.tasks.delete(parsed.data.taskId, ctx.member.id);
  } catch (error) {
    return failure(error, "deleteTaskAction");
  }
  revalidateTasks();
  redirect("/tasks");
}

export async function duplicateTaskAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = taskIdSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid task." };
  let id: number;
  try {
    id = (await app.tasks.duplicate(parsed.data.taskId, ctx.member.id)).id;
  } catch (error) {
    return failure(error, "duplicateTaskAction");
  }
  revalidateTasks();
  redirect(`/tasks?task=${id}`);
}

/** Drag-and-drop and the "Move to" menu both land here; moving to Blocked requires a reason. */
export async function moveTaskAction(taskId: number, status: TaskStatus, blockedReason?: string): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = moveTaskSchema.safeParse({ taskId, status, blockedReason });
  if (!parsed.success) return { ok: false, message: "Invalid move." };
  try {
    await app.tasks.move(parsed.data.taskId, parsed.data.status, { actorId: ctx.member.id, blockedReason: parsed.data.blockedReason });
  } catch (error) {
    return failure(error, "moveTaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function setBlockedReasonAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = blockedReasonSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Explain why the task is blocked." };
  try {
    await app.tasks.setBlockedReason(parsed.data.taskId, parsed.data.reason!, ctx.member.id);
  } catch (error) {
    return failure(error, "setBlockedReasonAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function toggleSubtaskAction(formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = toggleSubtaskSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid subtask." };
  try {
    await app.tasks.toggleSubtask(parsed.data.taskId, parsed.data.subtaskId, parsed.data.done, ctx.member.id);
  } catch (error) {
    return failure(error, "toggleSubtaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function addSubtaskAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = addSubtaskSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Enter a checklist item (up to 160 characters)." };
  try {
    await app.tasks.addSubtask(parsed.data.taskId, parsed.data.title, ctx.member.id);
  } catch (error) {
    return failure(error, "addSubtaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function renameSubtaskAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = renameSubtaskSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Enter a checklist item (up to 160 characters)." };
  try {
    await app.tasks.renameSubtask(parsed.data.taskId, parsed.data.subtaskId, parsed.data.title, ctx.member.id);
  } catch (error) {
    return failure(error, "renameSubtaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function deleteSubtaskAction(formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = deleteSubtaskSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid subtask." };
  try {
    await app.tasks.deleteSubtask(parsed.data.taskId, parsed.data.subtaskId, ctx.member.id);
  } catch (error) {
    return failure(error, "deleteSubtaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

const COMMENT_HINT = "Write a comment (up to 2,000 characters).";

/** Comment composer: the body already carries `@[Name](memberId)` mentions (mentioned members are notified). */
export async function addCommentAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = taskCommentSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: COMMENT_HINT };
  try {
    await app.tasks.addComment(parsed.data.taskId, parsed.data.body, ctx.member.id);
  } catch (error) {
    return failure(error, "addCommentAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function editCommentAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = editCommentSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: COMMENT_HINT };
  try {
    await app.tasks.editComment(parsed.data.commentId, parsed.data.body, ctx.member.id);
  } catch (error) {
    return failure(error, "editCommentAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function deleteCommentAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = commentIdSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid comment." };
  try {
    await app.tasks.deleteComment(parsed.data.commentId, ctx.member.id);
  } catch (error) {
    return failure(error, "deleteCommentAction");
  }
  revalidateTasks();
  return { ok: true };
}

/** Attachment upload (multipart FormData `file`): validated in the domain, stored on disk, recorded per task. */
export async function uploadAttachmentAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = taskIdSchema.safeParse(textEntries(formData));
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File)) return { ok: false, message: "Choose a file to upload." };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, message: `Files can be up to ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.` };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await app.tasks.uploadAttachment(parsed.data.taskId, { name: file.name, size: file.size, bytes }, ctx.member.id);
  } catch (error) {
    return failure(error, "uploadAttachmentAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function deleteAttachmentAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = attachmentIdSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid attachment." };
  try {
    await app.tasks.deleteAttachment(parsed.data.attachmentId, ctx.member.id);
  } catch (error) {
    return failure(error, "deleteAttachmentAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function logTimeAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = logTimeSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Enter hours like 1.5 (quarter-hour steps, up to 24)." };
  try {
    await app.tasks.logTime(parsed.data.taskId, { hours: parsed.data.hours, note: parsed.data.note }, ctx.member.id);
  } catch (error) {
    return failure(error, "logTimeAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function deleteTimeEntryAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = timeEntryIdSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid time entry." };
  try {
    await app.tasks.deleteTimeEntry(parsed.data.entryId, ctx.member.id);
  } catch (error) {
    return failure(error, "deleteTimeEntryAction");
  }
  revalidateTasks();
  return { ok: true };
}
