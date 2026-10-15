import Link from "next/link";
import { Card } from "@/shared/ui/card";
import { Table, TD, TH, THead, TR } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { TASK_STATUS_LABELS } from "../../domain/task";
import { ClientBadge, DueLabel, PriorityBadge, STATUS_DOT, type TaskCardModel } from "./task-badges";

/** "List View": the same filtered tasks as a dense table; each row opens the task slide-over. */
export function TaskList({ tasks }: { tasks: ReadonlyArray<TaskCardModel> }) {
  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState icon="filter_alt_off" title="No tasks match these filters" description="Clear a filter or create a new task." />
      </Card>
    );
  }
  return (
    <Card flush>
      <Table>
          <THead>
            <TR>
              <TH>Task Name</TH>
              <TH>Workspace / Client</TH>
              <TH>Status</TH>
              <TH>Priority</TH>
              <TH>Assignee</TH>
              <TH>Due Date</TH>
              <TH align="right">Subtasks</TH>
            </TR>
          </THead>
          <tbody>
            {tasks.map((t) => (
              <TR key={t.id}>
                <TD className="min-w-64">
                  <Link href={t.href} scroll={false} className="text-label-md text-ink hover:text-accent">
                    {t.title}
                  </Link>
                </TD>
                <TD>
                  <ClientBadge name={t.client} internal={t.internal} className="max-w-48" />
                </TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-body-sm whitespace-nowrap text-ink-muted">
                    <span className={`size-1.5 rounded-full ${STATUS_DOT[t.status]}`} aria-hidden />
                    {TASK_STATUS_LABELS[t.status]}
                  </span>
                </TD>
                <TD>
                  <PriorityBadge priority={t.priority} />
                </TD>
                <TD className="text-body-sm whitespace-nowrap text-ink-muted">{t.assigneeName ?? "Unassigned"}</TD>
                <TD className="whitespace-nowrap">
                  <DueLabel due={t.status === "completed" ? t.doneDue : t.openDue} />
                </TD>
                <TD align="right" className="text-body-sm">
                  {t.subtasks.total > 0 ? `${t.subtasks.done} / ${t.subtasks.total}` : "—"}
                </TD>
              </TR>
            ))}
          </tbody>
      </Table>
    </Card>
  );
}
