import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, taskAttachments, tasks } from "@/server/db/schema";
import { NotFoundError } from "../../shared-types";
import type { NewTaskAttachment, TaskAttachment, TaskAttachmentRepository } from "../application/ports";

const columns = {
  id: taskAttachments.id,
  taskId: taskAttachments.taskId,
  uploadedById: taskAttachments.uploadedById,
  uploadedByName: members.name,
  fileName: taskAttachments.fileName,
  mimeType: taskAttachments.mimeType,
  sizeBytes: taskAttachments.sizeBytes,
  storageKey: taskAttachments.storageKey,
  createdAt: taskAttachments.createdAt,
};

/** Attachment rows of one workspace: every query goes through the owning task's workspace. */
export class DrizzleTaskAttachmentRepository implements TaskAttachmentRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private select() {
    return this.db
      .select(columns)
      .from(taskAttachments)
      .innerJoin(tasks, and(eq(tasks.id, taskAttachments.taskId), eq(tasks.workspaceId, this.workspaceId)))
      .leftJoin(members, eq(members.id, taskAttachments.uploadedById));
  }

  listForTask(taskId: number): Promise<TaskAttachment[]> {
    return this.select().where(eq(taskAttachments.taskId, taskId)).orderBy(desc(taskAttachments.createdAt), desc(taskAttachments.id));
  }

  async findById(id: number) {
    const [row] = await this.select().where(eq(taskAttachments.id, id));
    return row ?? null;
  }

  async create(attachment: NewTaskAttachment, now: Date) {
    const [task] = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, attachment.taskId), eq(tasks.workspaceId, this.workspaceId)));
    if (!task) throw new NotFoundError("Task", attachment.taskId);
    const [row] = await this.db
      .insert(taskAttachments)
      .values({ ...attachment, createdAt: now })
      .returning({ id: taskAttachments.id });
    await this.db.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, attachment.taskId));
    return (await this.findById(row!.id))!;
  }

  async delete(id: number) {
    const owned = this.db.select({ id: tasks.id }).from(tasks).where(eq(tasks.workspaceId, this.workspaceId));
    const deleted = await this.db
      .delete(taskAttachments)
      .where(and(eq(taskAttachments.id, id), inArray(taskAttachments.taskId, owned)))
      .returning({ id: taskAttachments.id });
    return deleted.length > 0;
  }

  async storageKeysForTask(taskId: number) {
    const rows = await this.select().where(eq(taskAttachments.taskId, taskId));
    return rows.map((r) => r.storageKey);
  }
}
