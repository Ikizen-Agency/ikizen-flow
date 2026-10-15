"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";
import { Overlay } from "@/shared/ui/overlay";
import type { DueDescriptor } from "../../domain/board";
import type { MentionTarget } from "../../domain/comment";
import { TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from "../../domain/task";
import { ClientBadge, DueLabel, PriorityBadge, STATUS_DOT } from "./task-badges";
import { TaskBlocker } from "./task-blocker";
import { TaskChecklist } from "./task-checklist";
import { TaskCommentComposer, TaskCommentList, type CommentView } from "./task-comments";
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
  comments: ReadonlyArray<CommentView>;
  /** Mention autocomplete candidates (workspace members). */
  members: ReadonlyArray<MentionTarget>;
  timeline: ReadonlyArray<{ id: number; actor: string; when: string; text: string }>;
  /** Extra drawer sections rendered after the checklist (attachments, time tracking). */
  children?: ReactNode;
  /** id of the attachments file input opened from the comment footer. */
  attachInputId?: string;
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-label-sm tracking-[0.08em] text-ink-subtle uppercase">{label}</p>
      <div className="mt-1 flex items-center gap-2 text-body-md text-ink">{children}</div>
    </div>
  );
}

/** `?task=<id>` slide-over: metadata, description, checklist, comments with @mentions and the activity log. */
export function TaskDrawer({ closeHref, editHref, task, comments, members, timeline, children, attachInputId }: TaskDrawerProps) {
  const done = task.status === "completed";

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
          <div className="mt-space-sm rounded-card border border-line-soft bg-canvas p-space-md text-body-md whitespace-pre-line text-ink-muted">
            {task.description ?? <span className="text-ink-subtle">No description provided.</span>}
          </div>
        </section>

        <TaskChecklist key={task.id} taskId={task.id} items={task.subtasks} />

        {children}

        <TaskCommentList key={`comments-${task.id}`} comments={comments} members={members} />

        <section aria-labelledby="task-activity">
          <h3 id="task-activity" className="text-headline-sm text-ink">
            Activity
          </h3>
          {timeline.length === 0 ? (
            <p className="mt-space-sm text-body-sm text-ink-subtle">No activity yet.</p>
          ) : (
            <ol className="mt-space-md flex flex-col gap-space-sm border-l border-line pl-space-md">
              {timeline.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute top-1.5 -left-[calc(var(--spacing-space-md)+4px)] size-2 rounded-full bg-success ring-2 ring-card" aria-hidden />
                  <p className="text-body-sm text-ink-muted">
                    <span className="text-label-md text-ink">{entry.actor}</span> {entry.text}
                  </p>
                  <p className="text-label-sm text-ink-subtle">{entry.when}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <TaskCommentComposer key={`composer-${task.id}`} taskId={task.id} members={members} attachInputId={attachInputId} />
    </Overlay>
  );
}
