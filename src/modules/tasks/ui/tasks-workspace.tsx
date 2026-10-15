import { connection } from "next/server";
import { container } from "@/server/container";
import { formatPercent } from "@/shared/domain/stats";
import { formatRelativeTime } from "@/shared/domain/time";
import { hrefWith } from "@/shared/ui/href";
import type { SearchParamsRecord } from "../../customers/application/list-params";
import type { Task } from "../application/ports";
import { parseTaskBoardParams, taskFilterQuery } from "../application/board-params";
import { describeTaskDue, DUE_FILTER_LABELS, DUE_FILTERS, dueWindow, operationalKpis, summarizeBoard } from "../domain/board";
import { compareTasksForBoard, subtaskProgress, TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "../domain/task";
import { CreateTaskDialog } from "./components/create-task-dialog";
import type { TaskCardModel } from "./components/task-badges";
import { TaskBoard } from "./components/task-board";
import { TaskDrawer } from "./components/task-drawer";
import { TaskFilters } from "./components/task-filters";
import { TaskKpiStrip } from "./components/task-kpi-strip";
import { TaskList } from "./components/task-list";
import { TasksHeader } from "./components/tasks-header";

const PATH = "/tasks";
const INTERNAL_LABEL = "Internal Studio";
const COMMENT_PREFIX = "commented: ";

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({ value, label: TASK_PRIORITY_LABELS[value] }));
const STATUS_OPTIONS = TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }));
const DUE_OPTIONS = DUE_FILTERS.map((value) => ({ value, label: DUE_FILTER_LABELS[value] }));

const milestoneDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** Container: reads URL state and the database, then renders the presentational board. */
export async function TasksWorkspace({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await connection();
  const params = parseTaskBoardParams(await searchParams);
  const now = container.clock();
  const filters = taskFilterQuery(params);

  const [all, board, members, customers, detail] = await Promise.all([
    container.repositories.tasks.listBoard({}),
    container.tasks.board({
      assigneeId: params.assigneeId,
      priority: params.priority,
      customerId: params.client,
      ...dueWindow(params.due, now),
    }),
    container.team.members(),
    container.repositories.customers.listOptions(),
    params.taskId ? container.tasks.detail(params.taskId) : Promise.resolve(null),
  ]);

  const toCard = (t: Task): TaskCardModel => ({
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    priority: t.priority,
    client: t.customerCompany ?? INTERNAL_LABEL,
    internal: t.customerCompany === null,
    assigneeName: t.assigneeName,
    openDue: describeTaskDue({ ...t, status: t.status === "completed" ? "todo" : t.status }, now),
    doneDue: describeTaskDue({ ...t, status: "completed", completedAt: t.completedAt ?? now }, now)!,
    blockedReason: t.blockedReason,
    commentCount: t.commentCount,
    subtasks: subtaskProgress(t.subtasks),
    href: hrefWith(PATH, filters, { task: t.id }),
  });

  const cards = TASK_STATUSES.flatMap((s) => board[s]).map(toCard);
  const listCards = TASK_STATUSES.flatMap((s) => board[s])
    .sort((a, b) => (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0) || compareTasksForBoard(a, b))
    .map(toCard);
  const summary = summarizeBoard(all, now);
  const kpis = operationalKpis(all, now);

  const clientIds = new Set(all.map((t) => t.customerId).filter((id): id is number => id !== null));
  const clientFilterOptions = [
    ...customers.filter((c) => clientIds.has(c.id)).map((c) => ({ value: String(c.id), label: c.company })),
    { value: "internal", label: INTERNAL_LABEL },
  ];
  const assignees = members.filter((m) => all.some((t) => t.assigneeId === m.id));

  const closeHref = hrefWith(PATH, filters);
  const createHrefs = Object.fromEntries(
    TASK_STATUSES.map((s) => [s, hrefWith(PATH, filters, { create: 1, status: s === "todo" ? undefined : s })]),
  ) as Record<TaskStatus, string>;

  return (
    <div className="flex flex-col gap-space-lg">
      <TasksHeader
        active={summary.active}
        attention={summary.attention}
        view={params.view}
        kanbanHref={hrefWith(PATH, filters, { view: undefined })}
        listHref={hrefWith(PATH, filters, { view: "list" })}
        createHref={createHrefs.todo}
      />
      <TaskFilters
        current={filters}
        members={assignees}
        priorityOptions={PRIORITY_OPTIONS}
        clientOptions={clientFilterOptions}
        dueOptions={DUE_OPTIONS}
        criticalBlockers={summary.criticalBlockers}
      />

      {params.view === "list" ? <TaskList tasks={listCards} /> : <TaskBoard tasks={cards} createHrefs={createHrefs} />}

      <TaskKpiStrip
        completion={formatPercent(kpis.completionRate)}
        velocity={kpis.velocityPerWeek.toFixed(1)}
        blockedHours={kpis.blockedHours}
        milestone={kpis.nextMilestone ? { title: kpis.nextMilestone.title, when: `Due ${milestoneDate.format(kpis.nextMilestone.dueAt)}` } : null}
      />

      {detail ? (
        <TaskDrawer
          closeHref={closeHref}
          task={{
            id: detail.task.id,
            code: detail.task.code,
            title: detail.task.title,
            client: detail.task.customerCompany ?? INTERNAL_LABEL,
            internal: detail.task.customerCompany === null,
            priority: detail.task.priority,
            status: detail.task.status,
            assigneeName: detail.task.assigneeName,
            due: describeTaskDue(detail.task, now),
            estimate: `${detail.task.estimateHours ? `${detail.task.estimateHours} Hours` : "Not estimated"} (${detail.task.trackedHours} Tracked)`,
            description: detail.task.description,
            subtasks: detail.task.subtasks.map(({ id, title, done }) => ({ id, title, done })),
          }}
          timeline={detail.activity.map((a) => {
            const comment = a.message.startsWith(COMMENT_PREFIX);
            const text = comment ? a.message.slice(COMMENT_PREFIX.length) : a.message.charAt(0).toUpperCase() + a.message.slice(1);
            return { id: a.id, actor: a.actorName ?? "System", when: formatRelativeTime(a.createdAt, now), text, comment };
          })}
        />
      ) : null}

      {params.create ? (
        <CreateTaskDialog
          closeHref={closeHref}
          defaultStatus={params.createStatus ?? "todo"}
          statusOptions={STATUS_OPTIONS}
          priorityOptions={PRIORITY_OPTIONS}
          clientOptions={customers.map((c) => ({ value: String(c.id), label: c.company }))}
          memberOptions={members.map((m) => ({ value: String(m.id), label: m.name }))}
        />
      ) : null}
    </div>
  );
}

export function TasksWorkspaceSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-space-lg" aria-busy="true" aria-label="Loading tasks">
      <div className="h-16 rounded-card bg-well" />
      <div className="h-20 rounded-card bg-well" />
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-96 rounded-card bg-well" />
        ))}
      </div>
    </div>
  );
}
