import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, members, taskSubtasks, tasks } from "@/server/db/schema";
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
};

export class DrizzleTaskRepository implements TaskRepository {
  constructor(private readonly db: Database) {}

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

  async listBoard({ assigneeId, customerId, priority, dueBefore }: TaskBoardQuery) {
    const filters: SQL[] = [];
    if (assigneeId) filters.push(eq(tasks.assigneeId, assigneeId));
    if (customerId === "internal") filters.push(isNull(tasks.customerId));
    else if (customerId) filters.push(eq(tasks.customerId, customerId));
    if (priority) filters.push(eq(tasks.priority, priority));
    if (dueBefore) filters.push(lte(tasks.dueAt, dueBefore));
    const rows = await this.baseQuery()
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(tasks.position), asc(tasks.id));
    return this.withSubtasks(rows);
  }

  async findById(id: number) {
    const rows = await this.baseQuery().where(eq(tasks.id, id));
    const [task] = await this.withSubtasks(rows);
    return task ?? null;
  }

  async latestCode() {
    const [row] = await this.db.select({ code: tasks.code }).from(tasks).orderBy(desc(tasks.id)).limit(1);
    return row?.code ?? null;
  }

  async create({ subtasks = [], ...task }: NewTask, now: Date) {
    const id = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(tasks)
        .values({ ...task, tags: task.tags ?? [], createdAt: now, updatedAt: now })
        .returning({ id: tasks.id });
      if (subtasks.length) {
        await tx.insert(taskSubtasks).values(subtasks.map((title, position) => ({ taskId: created!.id, title, position })));
      }
      return created!.id;
    });
    return (await this.findById(id))!;
  }

  async updateStatus(id: number, update: TaskStatusUpdate) {
    await this.db.update(tasks).set(update).where(eq(tasks.id, id));
  }
}
