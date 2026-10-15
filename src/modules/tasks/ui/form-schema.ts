import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "../domain/task";

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

export const createTaskSchema = z
  .object({
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
      .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 999), "Enter whole hours between 1 and 999.")
      .transform((v) => (v ? Number(v) : null)),
    tags: list(/,/, 5, 32),
    subtasks: list(/\r?\n/, 20, 160),
  })
  .transform(({ dueDate, dueTime, ...rest }) => ({
    ...rest,
    // Interpreted in the server's zone, consistent with seeded due times.
    dueAt: dueDate ? new Date(`${dueDate}T${dueTime || "17:00"}`) : null,
  }));

export type CreateTaskValues = z.output<typeof createTaskSchema>;

export interface CreateTaskState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.input<typeof createTaskSchema>, string[]>>;
  values?: Record<string, string>;
}

export const INITIAL_CREATE_TASK_STATE: CreateTaskState = { status: "idle" };

export const moveTaskSchema = z.object({ taskId: id, status: z.enum(TASK_STATUSES) });

export const toggleSubtaskSchema = z.object({
  taskId: id,
  subtaskId: id,
  done: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const addSubtaskSchema = z.object({ taskId: id, title: z.string().trim().min(1).max(160) });

export const taskCommentSchema = z.object({ taskId: id, body: z.string().trim().min(1).max(1000) });

export interface TaskMutationResult {
  ok: boolean;
  message?: string;
}
