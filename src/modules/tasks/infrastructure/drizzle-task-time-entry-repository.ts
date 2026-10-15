import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, taskTimeEntries, tasks } from "@/server/db/schema";
import { NotFoundError } from "../../shared-types";
import type { TaskTimeEntry, TaskTimeEntryRepository } from "../application/ports";

const columns = {
  id: taskTimeEntries.id,
  taskId: taskTimeEntries.taskId,
  memberId: taskTimeEntries.memberId,
  memberName: members.name,
  minutes: taskTimeEntries.minutes,
  note: taskTimeEntries.note,
  loggedAt: taskTimeEntries.loggedAt,
};

/** Time entries of one workspace: every query goes through the owning task's workspace. */
export class DrizzleTaskTimeEntryRepository implements TaskTimeEntryRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private select() {
    return this.db
      .select(columns)
      .from(taskTimeEntries)
      .innerJoin(tasks, and(eq(tasks.id, taskTimeEntries.taskId), eq(tasks.workspaceId, this.workspaceId)))
      .leftJoin(members, eq(members.id, taskTimeEntries.memberId));
  }

  listForTask(taskId: number): Promise<TaskTimeEntry[]> {
    return this.select().where(eq(taskTimeEntries.taskId, taskId)).orderBy(desc(taskTimeEntries.loggedAt), desc(taskTimeEntries.id));
  }

  async findById(id: number) {
    const [row] = await this.select().where(eq(taskTimeEntries.id, id));
    return row ?? null;
  }

  async create(entry: { taskId: number; memberId: number | null; minutes: number; note: string | null; loggedAt: Date }) {
    const [task] = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, entry.taskId), eq(tasks.workspaceId, this.workspaceId)));
    if (!task) throw new NotFoundError("Task", entry.taskId);
    const [row] = await this.db
      .insert(taskTimeEntries)
      .values({ ...entry, createdAt: entry.loggedAt })
      .returning({ id: taskTimeEntries.id });
    await this.db.update(tasks).set({ updatedAt: entry.loggedAt }).where(eq(tasks.id, entry.taskId));
    return (await this.findById(row!.id))!;
  }

  async delete(id: number) {
    const owned = this.db.select({ id: tasks.id }).from(tasks).where(eq(tasks.workspaceId, this.workspaceId));
    await this.db.delete(taskTimeEntries).where(and(eq(taskTimeEntries.id, id), inArray(taskTimeEntries.taskId, owned)));
  }
}
