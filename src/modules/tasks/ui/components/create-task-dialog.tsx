"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Field, Input, Select, Textarea } from "@/shared/ui/input";
import { Overlay } from "@/shared/ui/overlay";
import { createTaskAction } from "../actions";
import { INITIAL_CREATE_TASK_STATE, type CreateTaskState } from "../form-schema";

interface Option {
  value: string;
  label: string;
}

export interface CreateTaskDialogProps {
  closeHref: string;
  defaultStatus: string;
  statusOptions: ReadonlyArray<Option>;
  priorityOptions: ReadonlyArray<Option>;
  clientOptions: ReadonlyArray<Option>;
  memberOptions: ReadonlyArray<Option>;
}

type FieldName = keyof NonNullable<CreateTaskState["fieldErrors"]>;

function Options({ options }: { options: ReadonlyArray<Option> }) {
  return options.map((o) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  ));
}

/** "Create Task" modal (also opened by the topbar "Create New" shortcut via `?create=1`). */
export function CreateTaskDialog({ closeHref, defaultStatus, statusOptions, priorityOptions, clientOptions, memberOptions }: CreateTaskDialogProps) {
  const [state, formAction, pending] = useActionState(createTaskAction, INITIAL_CREATE_TASK_STATE);
  const v = state.values ?? {};
  const err = (field: FieldName) => state.fieldErrors?.[field]?.[0];
  const a11y = (field: FieldName) =>
    err(field) ? { "aria-invalid": true as const, "aria-describedby": `${field}-error` } : {};

  return (
    <Overlay closeHref={closeHref} labelledBy="create-task-title">
      <div className="flex items-center justify-between bg-surface-container-low p-space-lg">
        <div className="flex items-center gap-2">
          <Icon name="add_task" size={24} className="text-accent" />
          <h2 id="create-task-title" className="text-headline-md text-ink">
            Create Task
          </h2>
        </div>
        <Link href={closeHref} scroll={false} aria-label="Close" className="rounded-control p-1 text-ink-subtle hover:text-ink">
          <Icon name="close" size={20} />
        </Link>
      </div>
      <form action={formAction} noValidate className="flex flex-col gap-space-md overflow-y-auto p-space-lg">
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
            <Select id="status" name="status" defaultValue={v.status ?? defaultStatus}>
              <Options options={statusOptions} />
            </Select>
          </Field>
          <Field label="Priority" htmlFor="priority" error={err("priority")}>
            <Select id="priority" name="priority" defaultValue={v.priority ?? "medium"}>
              <Options options={priorityOptions} />
            </Select>
          </Field>
          <Field label="Client / Workspace" htmlFor="customerId" error={err("customerId")}>
            <Select id="customerId" name="customerId" defaultValue={v.customerId ?? "internal"}>
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
        <Field label="Subtasks" htmlFor="subtasks" error={err("subtasks")} hint="One checklist item per line.">
          <Textarea id="subtasks" name="subtasks" placeholder={"Audit feedback notes\nMap navigation tree"} defaultValue={v.subtasks} {...a11y("subtasks")} />
        </Field>
        <div className="flex items-center justify-end gap-space-sm pt-space-sm">
          <Link href={closeHref} scroll={false} className={buttonClasses({ variant: "ghost" })}>
            Cancel
          </Link>
          <Button type="submit" icon="add" disabled={pending}>
            {pending ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
