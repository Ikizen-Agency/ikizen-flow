import "server-only";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, orders, payments, taskAttachments, tasks, workspaceMemberships, workspaces } from "@/server/db/schema";
import type { NewWorkspaceWithOwner, WorkspaceDirectory, WorkspaceMembership } from "../application/ports";

export class DrizzleWorkspaceDirectory implements WorkspaceDirectory {
  constructor(private readonly db: Database) {}

  async listForUser(userId: string): Promise<WorkspaceMembership[]> {
    const rows = await this.db
      .select({ workspace: workspaces, role: workspaceMemberships.role, member: members })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
      .innerJoin(members, eq(members.id, workspaceMemberships.memberId))
      .where(eq(workspaceMemberships.userId, userId))
      .orderBy(asc(workspaces.createdAt), asc(workspaces.id));
    return rows.map(({ workspace, role, member }) => ({
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, tagline: workspace.tagline, createdAt: workspace.createdAt },
      role,
      member: { id: member.id, name: member.name, email: member.email, role: member.role, userId: member.userId, avatarColor: member.avatarColor },
    }));
  }

  async slugExists(slug: string, exceptId?: number) {
    const where = exceptId ? and(eq(workspaces.slug, slug), ne(workspaces.id, exceptId)) : eq(workspaces.slug, slug);
    const [row] = await this.db.select({ id: workspaces.id }).from(workspaces).where(where).limit(1);
    return Boolean(row);
  }

  async findById(id: number) {
    const [row] = await this.db.select().from(workspaces).where(eq(workspaces.id, id));
    return row ? { id: row.id, name: row.name, slug: row.slug, tagline: row.tagline, createdAt: row.createdAt } : null;
  }

  async update(id: number, changes: { name: string; slug: string; tagline: string }) {
    const [row] = await this.db.update(workspaces).set(changes).where(eq(workspaces.id, id)).returning();
    return { id: row!.id, name: row!.name, slug: row!.slug, tagline: row!.tagline, createdAt: row!.createdAt };
  }

  delete(id: number) {
    return this.db.transaction(async (tx) => {
      const files = await tx
        .select({ key: taskAttachments.storageKey })
        .from(taskAttachments)
        .where(inArray(taskAttachments.taskId, tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.workspaceId, id))));
      // `orders.customer_id` is ON DELETE RESTRICT, so orders (and their payments) go before the cascading workspace delete.
      await tx.delete(payments).where(eq(payments.workspaceId, id));
      await tx.delete(orders).where(eq(orders.workspaceId, id));
      await tx.delete(workspaces).where(eq(workspaces.id, id));
      return files.map((f) => f.key);
    });
  }

  async renameUserMembers(userId: string, name: string) {
    await this.db.update(members).set({ name }).where(eq(members.userId, userId));
  }

  async createWithOwner({ name, slug, tagline, owner }: NewWorkspaceWithOwner, now: Date): Promise<WorkspaceMembership> {
    return this.db.transaction(async (tx) => {
      const [workspace] = await tx.insert(workspaces).values({ name, slug, tagline, createdAt: now }).returning();
      const [member] = await tx
        .insert(members)
        .values({ workspaceId: workspace!.id, userId: owner.userId, name: owner.name, email: owner.email, role: owner.title, createdAt: now })
        .returning();
      await tx.insert(workspaceMemberships).values({ workspaceId: workspace!.id, userId: owner.userId, memberId: member!.id, role: "owner", createdAt: now });
      return {
        workspace: { id: workspace!.id, name: workspace!.name, slug: workspace!.slug, tagline: workspace!.tagline, createdAt: workspace!.createdAt },
        role: "owner" as const,
        member: { id: member!.id, name: member!.name, email: member!.email, role: member!.role, userId: member!.userId },
      };
    });
  }
}
