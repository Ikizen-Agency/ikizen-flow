"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { Overlay } from "@/shared/ui/overlay";
import type { DueDescriptor } from "../../domain/board";
import { TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from "../../domain/task";
import { commentOnTaskAction } from "../actions";
import type { TaskMutationResult } from "../form-schema";
import { ClientBadge, DueLabel, PriorityBadge, STATUS_DOT } from "./task-badges";
import { TaskBlocker } from "./task-blocker";
import { TaskChecklist } from "./task-checklist";
import { TaskDrawerMenu } from "./task-drawer-menu";

export interface TaskDrawerProps {
  closeHref: string;
  editHref: string;
  task: {
    id: number;
    code: string;
    title: string;
    client: string;
    internal: boolean;
    priority: TaskPriority;
    status: TaskStatus;
    blockedReason: string | null;
    assigneeName: string | null;
    due: DueDescriptor | null;
    estimate: string;
    description: string | null;
    subtasks: ReadonlyArray<{ id: number; title: string; done: boolean }>;
  };
  timeline: ReadonlyArray<{ id: number; actor: string; when: string; text: string; comment: boolean }>;
}

const IDLE: TaskMutationResult = { ok: true };

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">{label}</p>
      <div className="mt-1 flex items-center gap-2 text-body-md text-ink">{children}</div>
    </div>
  );
}

/** `?task=<id>` slide-over: metadata, description, a live subtask checklist and the activity/comment timeline. */
export function TaskDrawer({ closeHref, editHref, task, timeline }: TaskDrawerProps) {
  const done = task.status === "completed";
  const [commentState, commentAction, commentPending] = useActionState(commentOnTaskAction, IDLE);
  const commentForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (commentState.ok && !commentPending) commentForm.current?.reset();
  }, [commentState, commentPending]);

  return (
    <Overlay closeHref={closeHref} variant="drawer" labelledBy="task-drawer-title">
      <div className="flex items-start justify-between gap-space-md border-b border-line-soft p-space-lg">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ClientBadge name={task.client} internal={task.internal} />
            <PriorityBadge priority={task.priority} done={done} />
            <span className="text-label-sm text-ink-subtle">• ID #{task.code}</span>
          </div>
          <h2 id="task-drawer-title" className="mt-space-sm text-headline-lg text-ink">
            {task.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TaskDrawerMenu taskId={task.id} code={task.code} title={task.title} editHref={editHref} />
          <Link href={closeHref} scroll={false} aria-label="Close" className="rounded-control p-1 text-ink-subtle hover:text-ink">
            <Icon name="close" size={20} />
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-space-lg overflow-y-auto p-space-lg">
        {task.status === "blocked" ? <TaskBlocker key={task.id} taskId={task.id} reason={task.blockedReason} /> : null}

        <dl className="grid grid-cols-1 gap-space-md rounded-card bg-surface-container-low p-space-md sm:grid-cols-2">
          <Meta label="Assignee">
            {task.assigneeName ? (
              <>
                <Avatar name={task.assigneeName} size="xs" />
                {task.assigneeName}
              </>
            ) : (
              <span className="text-ink-subtle">Unassigned</span>
            )}
          </Meta>
          <Meta label="Due Date">
            <DueLabel due={task.due} className="text-body-md" />
          </Meta>
          <Meta label="Status Column">
            <span className={cn("size-2 rounded-full", STATUS_DOT[task.status])} aria-hidden />
            <span className="text-accent">{TASK_STATUS_LABELS[task.status]}</span>
          </Meta>
          <Meta label="Estimate">{task.estimate}</Meta>
        </dl>

        <section aria-labelledby="task-description">
          <h3 id="task-description" className="text-headline-sm text-ink">
            Description
          </h3>
          <div className="mt-space-sm rounded-card border border-line-soft bg-canvas p-space-md text-body-md text-ink-muted">
            {task.description ?? <span className="text-ink-subtle">No description provided.</span>}
          </div>
        </section>

        <TaskChecklist key={task.id} taskId={task.id} items={task.subtasks} />

        <section aria-labelledby="task-activity">
          <h3 id="task-activity" className="text-headline-sm text-ink">
            Activity &amp; Comments
          </h3>
          {timeline.length === 0 ? (
            <p className="mt-space-sm text-body-sm text-ink-subtle">No activity yet. Post the first update below.</p>
          ) : (
            <ol className="mt-space-md flex flex-col gap-space-md border-l border-line pl-space-md">
              {timeline.map((entry) => (
                <li key={entry.id} className="relative">
                  <span
                    className={cn("absolute top-3 -left-[calc(var(--spacing-space-md)+5px)] size-2.5 rounded-full ring-2 ring-card", entry.comment ? "bg-accent" : "bg-success")}
                    aria-hidden
                  />
                  <div className="rounded-card bg-surface-container-low p-space-sm">
                    <div className="flex items-center justify-between gap-space-sm">
                      <span className="text-label-md text-ink">{entry.actor}</span>
                      <span className="text-label-sm text-ink-subtle">{entry.when}</span>
                    </div>
                    <p className="mt-1 text-body-sm text-ink-muted">{entry.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <form ref={commentForm} action={commentAction} className="border-t border-line-soft bg-card p-space-md">
        <input type="hidden" name="taskId" value={task.id} />
        <div className="flex items-center gap-space-sm rounded-control bg-surface-container-low p-1 pl-space-sm">
          <input
            name="body"
            required
            maxLength={1000}
            aria-label="Add a comment"
            placeholder="Add a comment or operational update..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-body-sm text-ink placeholder:text-ink-placeholder focus:outline-none"
          />
          <Button type="submit" size="sm" trailingIcon="send" disabled={commentPending}>
            {commentPending ? "Posting..." : "Post"}
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-between text-label-sm text-ink-subtle">
          {commentState.ok ? (
            <span>
              Press <kbd className="rounded bg-surface-container px-1">⌘Enter</kbd> to submit
            </span>
          ) : (
            <span className="text-danger-strong">{commentState.message}</span>
          )}
          <span className="flex items-center gap-1">
            <button type="button" disabled title="Attachments (coming soon)" className="p-1 disabled:opacity-50">
              <Icon name="attach_file" size={16} />
            </button>
            <button type="button" disabled title="Mentions (coming soon)" className="p-1 disabled:opacity-50">
              <Icon name="alternate_email" size={16} />
            </button>
          </span>
        </div>
      </form>
    </Overlay>
  );
}
