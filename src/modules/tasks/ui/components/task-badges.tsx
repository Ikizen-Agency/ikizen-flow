import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
import type { DueDescriptor, DueTone } from "../../domain/board";
import { TASK_PRIORITY_LABELS, type TaskPriority, type TaskStatus } from "../../domain/task";

/** Serializable card model shared by the board, list and drawer. */
export interface TaskCardModel {
  id: number;
  code: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  client: string;
  internal: boolean;
  assigneeName: string | null;
  /** Due label while open, and the label to show once completed (both computed on the server). */
  openDue: DueDescriptor | null;
  doneDue: DueDescriptor;
  blockedReason: string | null;
  commentCount: number;
  subtasks: { done: number; total: number; percent: number };
  href: string;
}

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-outline",
  in_progress: "bg-accent",
  blocked: "bg-danger",
  completed: "bg-success",
};

export const DUE_TONE_TEXT: Record<DueTone, string> = {
  danger: "text-danger-strong",
  warning: "text-warning-strong",
  neutral: "text-ink-subtle",
  success: "text-success-strong",
};

const CLIENT_PALETTES = [
  "bg-accent-tint text-accent",
  "bg-success-tint text-success-strong",
  "bg-warning-tint text-warning-strong",
  "bg-secondary-container text-on-secondary-fixed-variant",
] as const;

function clientPalette(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CLIENT_PALETTES[hash % CLIENT_PALETTES.length];
}

export function ClientBadge({ name, internal, className }: { name: string; internal: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block truncate rounded-badge px-2 py-0.5 text-label-sm",
        internal ? "bg-well text-ink-muted" : clientPalette(name),
        className,
      )}
      title={name}
    >
      {name}
    </span>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, { className: string; icon?: string }> = {
  urgent: { className: "border-danger-line bg-danger-tint text-danger-strong", icon: "priority_high" },
  high: { className: "border-warning-line bg-warning-tint text-warning-strong", icon: "flag" },
  medium: { className: "border-line bg-well text-neutral-strong" },
  low: { className: "border-line-soft bg-card text-ink-subtle" },
};

export function PriorityBadge({ priority, done = false }: { priority: TaskPriority; done?: boolean }) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-badge border border-success-line bg-success-tint px-2 py-0.5 text-label-sm text-success-strong">
        <Icon name="check_circle" size={14} />
        Done
      </span>
    );
  }
  const style = PRIORITY_STYLE[priority];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-badge border px-2 py-0.5 text-label-sm", style.className)}>
      {style.icon ? <Icon name={style.icon} size={14} /> : null}
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function DueLabel({ due, className }: { due: DueDescriptor | null; className?: string }) {
  if (!due) return <span className={cn("text-label-sm text-ink-placeholder", className)}>No due date</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-label-sm", DUE_TONE_TEXT[due.tone], className)}>
      <Icon name={due.icon} size={14} />
      {due.label}
    </span>
  );
}
