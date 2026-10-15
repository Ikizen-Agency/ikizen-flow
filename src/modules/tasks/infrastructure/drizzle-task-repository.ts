import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, max, ne, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, members, taskSubtasks, tasks } from "@/server/db/schema";
import { NotFoundError } from "../../shared-types";
import type { NewTask, Subtask, Task, TaskBoardQuery, TaskRepository, TaskStatusUpdate } from "../application/ports";

const taskColumns = {
  id: tasks.id,
  code: tasks.code,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  customerId: tasks.customerId,
  customerCompany: customers.company,
  assigneeId: tasks.assigneeId,
  assigneeName: members.name,
  dueAt: tasks.dueAt,
  estimateHours: tasks.estimateHours,
  trackedHours: tasks.trackedHours,
  blockedReason: tasks.blockedReason,
  tags: tasks.tags,
  commentCount: tasks.commentCount,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
};

/** Tasks of one workspace: every query is filtered by `workspaceId`; subtasks are reached through their task. */
export class DrizzleTaskRepository implements TaskRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private inWorkspace(...filters: Array<SQL | undefined>) {
    return and(eq(tasks.workspaceId, this.workspaceId), ...filters);
  }

  private async owns(taskId: number) {
    const [row] = await this.db.select({ id: tasks.id }).from(tasks).where(this.inWorkspace(eq(tasks.id, taskId)));
    return Boolean(row);
  }

  /** Customers and assignees must belong to the same workspace as the task. */
  private async assertReferences({ customerId, assigneeId }: Pick<NewTask, "customerId" | "assigneeId">) {
    if (customerId) {
      const [row] = await this.db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.workspaceId, this.workspaceId)));
      if (!row) throw new NotFoundError("Customer", customerId);
    }
    if (assigneeId) {
      const [row] = await this.db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.id, assigneeId), eq(members.workspaceId, this.workspaceId)));
      if (!row) throw new NotFoundError("Member", assigneeId);
    }
  }

  private async withSubtasks(rows: Array<Omit<Task, "subtasks">>): Promise<Task[]> {
    if (rows.length === 0) return [];
    const subtasks = await this.db
      .select()
      .from(taskSubtasks)
      .where(
        inArray(
          taskSubtasks.taskId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(taskSubtasks.position));
    const byTask = new Map<number, Subtask[]>();
    for (const s of subtasks) {
      const list = byTask.get(s.taskId) ?? [];
      list.push({ id: s.id, title: s.title, done: s.done, position: s.position });
      byTask.set(s.taskId, list);
    }
    return rows.map((r) => ({ ...r, subtasks: byTask.get(r.id) ?? [] }));
  }

  private baseQuery() {
    return this.db
      .select(taskColumns)
      .from(tasks)
      .leftJoin(customers, eq(customers.id, tasks.customerId))
      .leftJoin(members, eq(members.id, tasks.assigneeId));
  }

  async listBoard({ assigneeId, customerId, priority, dueBefore, openOnly }: TaskBoardQuery) {
    const filters: SQL[] = [eq(tasks.workspaceId, this.workspaceId)];
    if (assigneeId) filters.push(eq(tasks.assigneeId, assigneeId));
    if (customerId === "internal") filters.push(isNull(tasks.customerId));
    else if (customerId) filters.push(eq(tasks.customerId, customerId));
    if (priority) filters.push(eq(tasks.priority, priority));
    if (dueBefore) filters.push(lte(tasks.dueAt, dueBefore));
    if (openOnly) filters.push(ne(tasks.status, "completed"));
    const rows = await this.baseQuery()
      .where(and(...filters))
      .orderBy(asc(tasks.position), asc(tasks.id));
    return this.withSubtasks(rows);
  }

  async findById(id: number) {
    const rows = await this.baseQuery().where(this.inWorkspace(eq(tasks.id, id)));
    const [task] = await this.withSubtasks(rows);
    return task ?? null;
  }

  async latestCode() {
    const [row] = await this.db.select({ code: tasks.code }).from(tasks).where(this.inWorkspace()).orderBy(desc(tasks.id)).limit(1);
    return row?.code ?? null;
  }

  async create({ subtasks = [], ...task }: NewTask, now: Date) {
    await this.assertReferences(task);
    const id = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(tasks)
        .values({ ...task, workspaceId: this.workspaceId, tags: task.tags ?? [], createdAt: now, updatedAt: now })
        .returning({ id: tasks.id });
      if (subtasks.length) {
        await tx.insert(taskSubtasks).values(subtasks.map((title, position) => ({ taskId: created!.id, title, position })));
      }
      return created!.id;
    });
    return (await this.findById(id))!;
  }

  async updateStatus(id: number, update: TaskStatusUpdate) {
    await this.db.update(tasks).set(update).where(this.inWorkspace(eq(tasks.id, id)));
  }

  async setSubtaskDone(taskId: number, subtaskId: number, done: boolean, now: Date) {
    if (!(await this.owns(taskId))) return false;
    const updated = await this.db
      .update(taskSubtasks)
      .set({ done })
      .where(and(eq(taskSubtasks.id, subtaskId), eq(taskSubtasks.taskId, taskId)))
      .returning({ id: taskSubtasks.id });
    if (updated.length === 0) return false;
    await this.db.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, taskId));
    return true;
  }

  async addSubtask(taskId: number, title: string, now: Date) {
    if (!(await this.owns(taskId))) throw new NotFoundError("Task", taskId);
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ last: max(taskSubtasks.position) })
        .from(taskSubtasks)
        .where(eq(taskSubtasks.taskId, taskId));
      await tx.insert(taskSubtasks).values({ taskId, title, position: (row?.last ?? -1) + 1 });
      await tx.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, taskId));
    });
  }

  async incrementCommentCount(id: number, now: Date) {
    await this.db
      .update(tasks)
      .set({ commentCount: sql`${tasks.commentCount} + 1`, updatedAt: now })
      .where(this.inWorkspace(eq(tasks.id, id)));
  }
}
