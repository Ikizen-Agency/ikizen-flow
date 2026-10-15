import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, taskComments, tasks } from "@/server/db/schema";
import { NotFoundError } from "../../shared-types";
import type { TaskComment, TaskCommentRepository } from "../application/ports";

const columns = {
  id: taskComments.id,
  taskId: taskComments.taskId,
  authorId: taskComments.authorId,
  authorName: members.name,
  body: taskComments.body,
  createdAt: taskComments.createdAt,
  editedAt: taskComments.editedAt,
};

/** Task comments of one workspace: every query joins (or sub-selects) the owning task's workspace. */
export class DrizzleTaskCommentRepository implements TaskCommentRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private ownedTaskIds() {
    return this.db.select({ id: tasks.id }).from(tasks).where(eq(tasks.workspaceId, this.workspaceId));
  }

  private select() {
    return this.db
      .select(columns)
      .from(taskComments)
      .innerJoin(tasks, and(eq(tasks.id, taskComments.taskId), eq(tasks.workspaceId, this.workspaceId)))
      .leftJoin(members, eq(members.id, taskComments.authorId));
  }

  listForTask(taskId: number): Promise<TaskComment[]> {
    return this.select().where(eq(taskComments.taskId, taskId)).orderBy(asc(taskComments.createdAt), asc(taskComments.id));
  }

  async findById(id: number) {
    const [row] = await this.select().where(eq(taskComments.id, id));
    return row ?? null;
  }

  async create({ taskId, authorId, body }: { taskId: number; authorId: number | null; body: string }, now: Date) {
    const [task] = await this.db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, this.workspaceId)));
    if (!task) throw new NotFoundError("Task", taskId);
    const [row] = await this.db.insert(taskComments).values({ taskId, authorId, body, createdAt: now }).returning({ id: taskComments.id });
    await this.db.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, taskId));
    return (await this.findById(row!.id))!;
  }

  async update(id: number, body: string, now: Date) {
    await this.db
      .update(taskComments)
      .set({ body, editedAt: now })
      .where(and(eq(taskComments.id, id), inArray(taskComments.taskId, this.ownedTaskIds())));
  }

  async delete(id: number) {
    await this.db.delete(taskComments).where(and(eq(taskComments.id, id), inArray(taskComments.taskId, this.ownedTaskIds())));
  }
}
