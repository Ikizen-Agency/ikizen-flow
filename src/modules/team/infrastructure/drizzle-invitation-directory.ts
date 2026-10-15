import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, workspaceInvitations, workspaceMemberships, workspaces } from "@/server/db/schema";
import type { InvitationDirectory } from "../application/ports";
import { normalizeEmail } from "../domain/roster";
import { grantMembership } from "./grant-membership";

/** Invitations by token hash, across workspaces. */
export class DrizzleInvitationDirectory implements InvitationDirectory {
  constructor(private readonly db: Database) {}

  async findByTokenHash(tokenHash: string) {
    const [row] = await this.db
      .select({
        invitation: {
          id: workspaceInvitations.id,
          email: workspaceInvitations.email,
          role: workspaceInvitations.role,
          invitedById: workspaceInvitations.invitedById,
          invitedByName: members.name,
          expiresAt: workspaceInvitations.expiresAt,
          acceptedAt: workspaceInvitations.acceptedAt,
          createdAt: workspaceInvitations.createdAt,
        },
        workspace: { id: workspaces.id, name: workspaces.name },
      })
      .from(workspaceInvitations)
      .innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
      .leftJoin(members, eq(members.id, workspaceInvitations.invitedById))
      .where(eq(workspaceInvitations.tokenHash, tokenHash));
    return row ?? null;
  }

  accept(invitationId: number, user: { id: string; name: string; email: string }, now: Date) {
    return this.db.transaction(async (tx) => {
      const [pending] = await tx.select({ workspaceId: workspaceInvitations.workspaceId }).from(workspaceInvitations).where(eq(workspaceInvitations.id, invitationId));
      if (!pending) return "already_used" as const;
      const [membership] = await tx
        .select({ id: workspaceMemberships.id })
        .from(workspaceMemberships)
        .where(and(eq(workspaceMemberships.workspaceId, pending.workspaceId), eq(workspaceMemberships.userId, user.id)));
      if (membership) return "already_member" as const;
      const [claimed] = await tx
        .update(workspaceInvitations)
        .set({ acceptedAt: now })
        .where(and(eq(workspaceInvitations.id, invitationId), isNull(workspaceInvitations.acceptedAt)))
        .returning({ workspaceId: workspaceInvitations.workspaceId, role: workspaceInvitations.role });
      if (!claimed) return "already_used" as const;
      await grantMembership(tx, claimed.workspaceId, { userId: user.id, name: user.name, email: normalizeEmail(user.email), role: claimed.role }, now);
      return "accepted" as const;
    });
  }
}
