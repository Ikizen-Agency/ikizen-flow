import { z } from "zod";
import { COMMENT_MAX_LENGTH } from "../domain/comment";
import { BLOCKED_REASON_MAX, normalizeBlockedReason, TASK_PRIORITIES, TASK_STATUSES } from "../domain/task";

const id = z.coerce.number().int().positive();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "This field is too long.")
    .optional()
    .transform((v) => v || null);

/** Splits free text on `separator`, trims, drops empties and case-insensitive duplicates. */
const list = (separator: RegExp, maxItems: number, maxLength: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const seen = new Set<string>();
      const items: string[] = [];
      for (const raw of (v ?? "").split(separator)) {
        const item = raw.trim();
        if (!item || seen.has(item.toLowerCase())) continue;
        seen.add(item.toLowerCase());
        items.push(item.slice(0, maxLength));
      }
      return items;
    })
    .refine((items) => items.length <= maxItems, `Use at most ${maxItems} entries.`);

const optionalId = z
  .string()
  .optional()
  .refine((v) => !v || v === "internal" || /^\d+$/.test(v), "Choose a valid option.")
  .transform((v) => (v && v !== "internal" ? Number(v) : null));

const taskFields = {
  title: z.string().trim().min(1, "Task title is required.").max(160, "Task title is too long."),
  description: optionalText(2000),
  status: z.enum(TASK_STATUSES, { error: "Choose a column." }),
  priority: z.enum(TASK_PRIORITIES, { error: "Choose a priority." }),
  customerId: optionalId,
  assigneeId: optionalId,
  dueDate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date."),
  dueTime: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{2}:\d{2}$/.test(v), "Use a valid time."),
  estimateHours: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 999), "Enter whole hours between 1 and 999."),
  tags: list(/,/, 5, 32),
};

// Interpreted in the server's zone, consistent with seeded due times.
const toDueAt = (dueDate?: string, dueTime?: string) => (dueDate ? new Date(`${dueDate}T${dueTime || "17:00"}`) : null);

export const createTaskSchema = z
  .object({ ...taskFields, subtasks: list(/\r?\n/, 20, 160) })
  .transform(({ dueDate, dueTime, estimateHours, ...rest }) => ({
    ...rest,
    estimateHours: estimateHours ? Number(estimateHours) : null,
    dueAt: toDueAt(dueDate, dueTime),
  }));

const blockedReasonText = z.string().max(BLOCKED_REASON_MAX * 2, "Keep the reason short.").optional();

/** Edit dialog: the create fields (without the checklist) plus the blocker explanation for blocked tasks. */
export const updateTaskSchema = z
  .object({ ...taskFields, taskId: id, blockedReason: blockedReasonText })
  .superRefine((v, ctx) => {
    if (v.status === "blocked" && !normalizeBlockedReason(v.blockedReason)) {
      ctx.addIssue({ code: "custom", path: ["blockedReason"], message: "Explain why the task is blocked." });
    }
  })
  .transform(({ dueDate, dueTime, estimateHours, blockedReason, ...rest }) => ({
    ...rest,
    estimateHours: estimateHours ? Number(estimateHours) : null,
    dueAt: toDueAt(dueDate, dueTime),
    blockedReason: rest.status === "blocked" ? normalizeBlockedReason(blockedReason) : null,
  }));

export interface UpdateTaskState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.input<typeof updateTaskSchema>, string[]>>;
  values?: Record<string, string>;
}

export const INITIAL_UPDATE_TASK_STATE: UpdateTaskState = { status: "idle" };

export type CreateTaskValues = z.output<typeof createTaskSchema>;

export interface CreateTaskState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.input<typeof createTaskSchema>, string[]>>;
  values?: Record<string, string>;
}

export const INITIAL_CREATE_TASK_STATE: CreateTaskState = { status: "idle" };

export const moveTaskSchema = z.object({
  taskId: id,
  status: z.enum(TASK_STATUSES),
  blockedReason: blockedReasonText.transform((v) => (v === undefined ? undefined : normalizeBlockedReason(v))),
});

export const taskIdSchema = z.object({ taskId: id });

export const blockedReasonSchema = z.object({
  taskId: id,
  reason: blockedReasonText.transform(normalizeBlockedReason).refine((v) => v !== null, "Explain why the task is blocked."),
});

export const renameSubtaskSchema = z.object({ taskId: id, subtaskId: id, title: z.string().trim().min(1).max(160) });

export const deleteSubtaskSchema = z.object({ taskId: id, subtaskId: id });

export const toggleSubtaskSchema = z.object({
  taskId: id,
  subtaskId: id,
  done: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const addSubtaskSchema = z.object({ taskId: id, title: z.string().trim().min(1).max(160) });

const commentBody = z.string().trim().min(1).max(COMMENT_MAX_LENGTH);

export const taskCommentSchema = z.object({ taskId: id, body: commentBody });

export const editCommentSchema = z.object({ commentId: id, body: commentBody });

export const commentIdSchema = z.object({ commentId: id });

export interface TaskMutationResult {
  ok: boolean;
  message?: string;
}

export const logTimeSchema = z.object({
  taskId: id,
  hours: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "Enter hours like 1.5")
    .transform(Number),
  note: optionalText(200),
});

export const attachmentIdSchema = z.object({ attachmentId: id });

export const timeEntryIdSchema = z.object({ entryId: id });
