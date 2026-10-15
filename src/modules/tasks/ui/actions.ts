"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getWorkspaceApp } from "@/server/request-context";
import { NotFoundError } from "../../shared-types";
import type { TaskStatus } from "../domain/task";
import {
  addSubtaskSchema,
  createTaskSchema,
  moveTaskSchema,
  taskCommentSchema,
  toggleSubtaskSchema,
  type CreateTaskState,
  type TaskMutationResult,
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

function failure(error: unknown, action: string): TaskMutationResult {
  if (error instanceof NotFoundError) return { ok: false, message: error.message };
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

/** Drag-and-drop and the "Move to" menu both land here; the domain keeps completion metadata consistent. */
export async function moveTaskAction(taskId: number, status: TaskStatus): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = moveTaskSchema.safeParse({ taskId, status });
  if (!parsed.success) return { ok: false, message: "Invalid move." };
  try {
    await app.tasks.move(parsed.data.taskId, parsed.data.status, { actorId: ctx.member.id });
  } catch (error) {
    return failure(error, "moveTaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function toggleSubtaskAction(formData: FormData): Promise<TaskMutationResult> {
  const { app } = await getWorkspaceApp();
  const parsed = toggleSubtaskSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Invalid subtask." };
  try {
    await app.tasks.toggleSubtask(parsed.data.taskId, parsed.data.subtaskId, parsed.data.done);
  } catch (error) {
    return failure(error, "toggleSubtaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function addSubtaskAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { app } = await getWorkspaceApp();
  const parsed = addSubtaskSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Enter a checklist item (up to 160 characters)." };
  try {
    await app.tasks.addSubtask(parsed.data.taskId, parsed.data.title);
  } catch (error) {
    return failure(error, "addSubtaskAction");
  }
  revalidateTasks();
  return { ok: true };
}

export async function commentOnTaskAction(_prev: TaskMutationResult, formData: FormData): Promise<TaskMutationResult> {
  const { ctx, app } = await getWorkspaceApp();
  const parsed = taskCommentSchema.safeParse(textEntries(formData));
  if (!parsed.success) return { ok: false, message: "Write a comment (up to 1,000 characters)." };
  try {
    await app.tasks.comment(parsed.data.taskId, parsed.data.body, ctx.member.id);
  } catch (error) {
    return failure(error, "commentOnTaskAction");
  }
  revalidateTasks();
  return { ok: true };
}
