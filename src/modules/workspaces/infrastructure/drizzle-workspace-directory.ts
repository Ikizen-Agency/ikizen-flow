import "server-only";
import { asc, eq } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, workspaceMemberships, workspaces } from "@/server/db/schema";
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
      member: { id: member.id, name: member.name, email: member.email, role: member.role, userId: member.userId },
    }));
  }

  async slugExists(slug: string) {
    const [row] = await this.db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
    return Boolean(row);
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
