"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { Card } from "@/shared/ui/card";
import { moveTaskAction } from "../../../tasks/ui/actions";

export interface CriticalTaskItem {
  id: number;
  title: string;
  priority: { label: string; tone: "danger" | "warning" | "neutral" };
  due: string;
  overdue: boolean;
  assignee: string | null;
  href: string;
}

const PRIORITY_TONE = {
  danger: "bg-danger-tint text-danger-strong",
  warning: "bg-warning-tint text-warning-strong",
  neutral: "bg-accent-tint text-accent",
} as const;

/** Tasks due by tomorrow; ticking the checkbox completes the task through the tasks Server Action. */
export function CriticalTasksCard({ items, dueToday }: { items: ReadonlyArray<CriticalTaskItem>; dueToday: number }) {
  const [visible, complete] = useOptimistic(items, (state, id: number) => state.filter((t) => t.id !== id));
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onComplete = (task: CriticalTaskItem) =>
    startTransition(async () => {
      complete(task.id);
      const result = await moveTaskAction(task.id, "completed");
      setMessage(result.ok ? { ok: true, text: `Completed "${task.title}".` } : { ok: false, text: result.message ?? "The task could not be completed." });
    });

  return (
    <Card className="flex flex-col gap-space-md" aria-labelledby="critical-title">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-2">
          <h2 id="critical-title" className="text-headline-sm text-ink">
            Critical Tasks
          </h2>
          <span className="tabular rounded-badge bg-accent-tint px-2 py-0.5 text-label-sm text-accent">{dueToday} Today</span>
        </div>
        <Link href="/tasks" className="text-label-sm text-accent hover:underline">
          All tasks
        </Link>
      </div>
      <p className={cn("text-body-sm", message ? (message.ok ? "text-success-strong" : "text-danger-strong") : "sr-only")} aria-live="polite">
        {message?.text}
      </p>
      {visible.length === 0 ? (
        <p className="rounded-card bg-surface-container-low p-space-md text-body-sm text-ink-subtle">Nothing due before the end of tomorrow.</p>
      ) : (
        <ul className="flex flex-col gap-space-sm">
          {visible.map((t) => (
            <li key={t.id} className="flex items-start gap-space-sm rounded-card border border-line-soft bg-surface-container-low p-space-sm">
              <input
                type="checkbox"
                aria-label={`Mark "${t.title}" as completed`}
                onChange={() => onComplete(t)}
                className="mt-1 size-4 shrink-0 cursor-pointer accent-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={t.href} className="truncate text-label-md text-ink hover:text-accent" title={t.title}>
                    {t.title}
                  </Link>
                  <span className={cn("shrink-0 rounded-badge px-1.5 py-0.5 text-label-sm", PRIORITY_TONE[t.priority.tone])}>{t.priority.label}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className={cn("text-body-sm", t.overdue || t.due.startsWith("Today") ? "text-danger-strong" : "text-ink-subtle")}>{t.due}</span>
                  {t.assignee ? (
                    <span className="flex items-center gap-1 text-body-sm text-ink-subtle">
                      <Avatar name={t.assignee} size="xs" />
                      {t.assignee.split(" ")[0]}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
