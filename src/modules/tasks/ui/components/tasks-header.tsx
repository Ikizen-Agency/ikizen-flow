import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { buttonClasses } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { PageHeader } from "@/shared/ui/page-header";

export interface TasksHeaderProps {
  workspaceName: string;
  active: number;
  attention: number;
  view: "kanban" | "list";
  kanbanHref: string;
  listHref: string;
  createHref: string;
}

function ViewLink({ href, active, icon, label }: { href: string; active: boolean; icon: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-control px-space-sm text-label-md transition-colors",
        active ? "bg-card text-accent shadow-level-1" : "text-ink-muted hover:text-ink",
      )}
    >
      <Icon name={icon} size={18} />
      {label}
    </Link>
  );
}

export function TasksHeader({ workspaceName, active, attention, view, kanbanHref, listHref, createHref }: TasksHeaderProps) {
  return (
    <PageHeader
      title="Tasks & Operations"
      meta={
        <span className="inline-flex items-center gap-1.5 rounded-badge border border-danger-line bg-danger-tint px-2 py-0.5 text-label-sm text-danger-strong">
          <span className="size-1.5 rounded-full bg-danger" aria-hidden />
          <span className="tabular">{active}</span> Active Tasks
          <span className="text-danger-line" aria-hidden>
            |
          </span>
          <span className="tabular">{attention}</span> Requiring Attention
        </span>
      }
      description={`Active operational sprints across ${workspaceName} client accounts`}
      actions={
        <>
          <nav aria-label="Board view" className="flex items-center gap-1 rounded-control bg-surface-container-low p-1">
            <ViewLink href={kanbanHref} active={view === "kanban"} icon="view_kanban" label="Kanban Board" />
            <ViewLink href={listHref} active={view === "list"} icon="format_list_bulleted" label="List View" />
          </nav>
          <Link href={createHref} scroll={false} className={buttonClasses({ size: "lg" })}>
            <Icon name="add" size={18} />
            Create Task
          </Link>
        </>
      }
    />
  );
}
