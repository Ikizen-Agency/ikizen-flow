"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Field, Input, Select, Textarea } from "@/shared/ui/input";
import { Overlay } from "@/shared/ui/overlay";
import { createTaskAction, updateTaskAction } from "../actions";
import { INITIAL_CREATE_TASK_STATE, INITIAL_UPDATE_TASK_STATE } from "../form-schema";

interface Option {
  value: string;
  label: string;
}

interface SharedProps {
  closeHref: string;
  statusOptions: ReadonlyArray<Option>;
  priorityOptions: ReadonlyArray<Option>;
  clientOptions: ReadonlyArray<Option>;
  memberOptions: ReadonlyArray<Option>;
}

export interface CreateTaskDialogProps extends SharedProps {
  defaultStatus: string;
}

/** Edit form values as strings (dates already split into the server's local date and time). */
export interface TaskFormValues {
  title: string;
  description: string;
  status: string;
  priority: string;
  customerId: string;
  assigneeId: string;
  dueDate: string;
  dueTime: string;
  estimateHours: string;
  tags: string;
  blockedReason: string;
}

export interface EditTaskDialogProps extends SharedProps {
  taskId: number;
  code: string;
  initial: TaskFormValues;
}

interface FormState {
  message?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  values?: Record<string, string>;
}

function Options({ options }: { options: ReadonlyArray<Option> }) {
  return options.map((o) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  ));
}

interface TaskFieldsProps extends SharedProps {
  state: FormState;
  defaults: Partial<TaskFormValues> & { status: string };
  editing: boolean;
}

/** Fields shared by the create and edit dialogs; the blocker reason appears while "Blocked" is selected. */
function TaskFields({ state, defaults, editing, statusOptions, priorityOptions, clientOptions, memberOptions }: TaskFieldsProps) {
  const v: Partial<Record<string, string>> = { ...defaults, ...state.values };
  const [status, setStatus] = useState(v.status ?? defaults.status);
  const err = (field: string) => state.fieldErrors?.[field]?.[0];
  const a11y = (field: string) => (err(field) ? { "aria-invalid": true as const, "aria-describedby": `${field}-error` } : {});

  return (
    <>
      {state.message ? (
        <p role="alert" className="rounded-control border border-danger-line bg-danger-tint p-space-sm text-body-sm text-danger-strong">
          {state.message}
        </p>
      ) : null}
      <Field label="Task Title" htmlFor="title" error={err("title")}>
        <Input id="title" name="title" required maxLength={160} placeholder="e.g. Deliver Q4 UX Architecture Wireframes" defaultValue={v.title} autoFocus {...a11y("title")} />
      </Field>
      <Field label="Description" htmlFor="description" error={err("description")}>
        <Textarea id="description" name="description" maxLength={2000} placeholder="Context, acceptance criteria, links..." defaultValue={v.description} {...a11y("description")} />
      </Field>
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <Field label="Status Column" htmlFor="status" error={err("status")}>
          <Select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <Options options={statusOptions} />
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority" error={err("priority")}>
          <Select id="priority" name="priority" defaultValue={v.priority ?? "medium"}>
            <Options options={priorityOptions} />
          </Select>
        </Field>
        {editing && status === "blocked" ? (
          <Field label="Blocked Reason" htmlFor="blockedReason" error={err("blockedReason")} hint="Required while the task is blocked." className="sm:col-span-2">
            <Input id="blockedReason" name="blockedReason" required maxLength={200} placeholder="e.g. Waiting on client sign-off" defaultValue={v.blockedReason} {...a11y("blockedReason")} />
          </Field>
        ) : null}
        <Field label="Client / Workspace" htmlFor="customerId" error={err("customerId")}>
          <Select id="customerId" name="customerId" defaultValue={v.customerId || "internal"}>
            <option value="internal">Internal Studio</option>
            <Options options={clientOptions} />
          </Select>
        </Field>
        <Field label="Assignee" htmlFor="assigneeId" error={err("assigneeId")}>
          <Select id="assigneeId" name="assigneeId" defaultValue={v.assigneeId ?? ""}>
            <option value="">Unassigned</option>
            <Options options={memberOptions} />
          </Select>
        </Field>
        <Field label="Due Date" htmlFor="dueDate" error={err("dueDate")}>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={v.dueDate} {...a11y("dueDate")} />
        </Field>
        <Field label="Due Time" htmlFor="dueTime" error={err("dueTime")} hint="Defaults to 5:00 PM.">
          <Input id="dueTime" name="dueTime" type="time" defaultValue={v.dueTime} {...a11y("dueTime")} />
        </Field>
        <Field label="Estimate (hours)" htmlFor="estimateHours" error={err("estimateHours")}>
          <Input id="estimateHours" name="estimateHours" inputMode="numeric" placeholder="16" defaultValue={v.estimateHours} {...a11y("estimateHours")} />
        </Field>
        <Field label="Tags" htmlFor="tags" error={err("tags")} hint="Comma separated, up to 5.">
          <Input id="tags" name="tags" placeholder="UX, Payments" defaultValue={v.tags} {...a11y("tags")} />
        </Field>
      </div>
      {editing ? null : (
        <Field label="Subtasks" htmlFor="subtasks" error={err("subtasks")} hint="One checklist item per line.">
          <Textarea id="subtasks" name="subtasks" placeholder={"Audit feedback notes\nMap navigation tree"} defaultValue={v.subtasks} {...a11y("subtasks")} />
        </Field>
      )}
    </>
  );
}

function DialogHeader({ id, icon, title, closeHref }: { id: string; icon: string; title: string; closeHref: string }) {
  return (
    <div className="flex items-center justify-between bg-surface-container-low p-space-lg">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={24} className="text-accent" />
        <h2 id={id} className="text-headline-md text-ink">
          {title}
        </h2>
      </div>
      <Link href={closeHref} scroll={false} aria-label="Close" className="rounded-control p-1 text-ink-subtle hover:text-ink">
        <Icon name="close" size={20} />
      </Link>
    </div>
  );
}

function DialogFooter({ closeHref, pending, label, pendingLabel, icon }: { closeHref: string; pending: boolean; label: string; pendingLabel: string; icon: string }) {
  return (
    <div className="flex items-center justify-end gap-space-sm pt-space-sm">
      <Link href={closeHref} scroll={false} className={buttonClasses({ variant: "ghost" })}>
        Cancel
      </Link>
      <Button type="submit" icon={icon} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
    </div>
  );
}

/** "Create Task" modal (also opened by the topbar "Create New" shortcut via `?create=1`). */
export function CreateTaskDialog({ defaultStatus, ...props }: CreateTaskDialogProps) {
  const [state, formAction, pending] = useActionState(createTaskAction, INITIAL_CREATE_TASK_STATE);
  return (
    <Overlay closeHref={props.closeHref} labelledBy="create-task-title">
      <DialogHeader id="create-task-title" icon="add_task" title="Create Task" closeHref={props.closeHref} />
      <form action={formAction} noValidate className="flex flex-col gap-space-md overflow-y-auto p-space-lg">
        <TaskFields {...props} state={state} defaults={{ status: defaultStatus }} editing={false} />
        <DialogFooter closeHref={props.closeHref} pending={pending} label="Create Task" pendingLabel="Creating..." icon="add" />
      </form>
    </Overlay>
  );
}

/** `?edit=<id>` modal: every task field, prefilled; saving reopens the task drawer. */
export function EditTaskDialog({ taskId, code, initial, ...props }: EditTaskDialogProps) {
  const [state, formAction, pending] = useActionState(updateTaskAction, INITIAL_UPDATE_TASK_STATE);
  return (
    <Overlay closeHref={props.closeHref} labelledBy="edit-task-title">
      <DialogHeader id="edit-task-title" icon="edit" title={`Edit Task #${code}`} closeHref={props.closeHref} />
      <form action={formAction} noValidate className="flex flex-col gap-space-md overflow-y-auto p-space-lg">
        <input type="hidden" name="taskId" value={taskId} />
        <TaskFields {...props} state={state} defaults={initial} editing />
        <DialogFooter closeHref={props.closeHref} pending={pending} label="Save Changes" pendingLabel="Saving..." icon="check" />
      </form>
    </Overlay>
  );
}
