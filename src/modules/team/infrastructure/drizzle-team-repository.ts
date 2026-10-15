import "server-only";
import { and, asc, count, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { AvatarColor } from "@/shared/domain/avatar-colors";
import type { Database } from "@/server/db/connect";
import { members, tasks, user, workspaceInvitations, workspaceMemberships } from "@/server/db/schema";
import type { WorkspaceRole } from "../../workspaces/domain/workspace";
import type { NewInvitation, NewTeammate, TeamRepository } from "../application/ports";
import type { Invitation } from "../domain/invitation";
import type { RosterEntry } from "../domain/roster";
import { memberColumns } from "./drizzle-member-repository";
import { grantMembership } from "./grant-membership";

const invitationColumns = {
  id: workspaceInvitations.id,
  email: workspaceInvitations.email,
  role: workspaceInvitations.role,
  invitedById: workspaceInvitations.invitedById,
  invitedByName: members.name,
  expiresAt: workspaceInvitations.expiresAt,
  acceptedAt: workspaceInvitations.acceptedAt,
  createdAt: workspaceInvitations.createdAt,
};

/** Team management for one workspace. */
export class DrizzleTeamRepository implements TeamRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private rosterQuery() {
    return this.db
      .select({ member: memberColumns, role: workspaceMemberships.role, createdAt: members.createdAt })
      .from(members)
      .leftJoin(workspaceMemberships, eq(workspaceMemberships.memberId, members.id))
      .$dynamic();
  }

  private active() {
    return and(eq(members.workspaceId, this.workspaceId), isNull(members.removedAt));
  }

  async roster(): Promise<RosterEntry[]> {
    const rows = await this.rosterQuery().where(this.active()).orderBy(asc(members.createdAt), asc(members.id));
    return rows.map((r) => ({ member: r.member, role: r.role ?? null, createdAt: r.createdAt }));
  }

  async findEntry(memberId: number) {
    const [row] = await this.rosterQuery().where(and(this.active(), eq(members.id, memberId)));
    return row ? { member: row.member, role: row.role ?? null, createdAt: row.createdAt } : null;
  }

  async findEntryByEmail(email: string) {
    const [row] = await this.rosterQuery().where(and(this.active(), eq(members.email, email)));
    return row ? { member: row.member, role: row.role ?? null, createdAt: row.createdAt } : null;
  }

  async ownerCount() {
    const [row] = await this.db
      .select({ value: count() })
      .from(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, this.workspaceId), eq(workspaceMemberships.role, "owner")));
    return row?.value ?? 0;
  }

  async addTeammate({ name, email, title }: NewTeammate, now: Date) {
    const [existing] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.workspaceId, this.workspaceId), eq(members.email, email)));
    if (existing) {
      const [restored] = await this.db.update(members).set({ name, role: title, removedAt: null }).where(eq(members.id, existing.id)).returning(memberColumns);
      return restored!;
    }
    const [created] = await this.db.insert(members).values({ workspaceId: this.workspaceId, name, email, role: title, createdAt: now }).returning(memberColumns);
    return created!;
  }

  grantAccess(input: { userId: string; name: string; email: string; role: WorkspaceRole }, now: Date) {
    return this.db.transaction((tx) => grantMembership(tx, this.workspaceId, input, now));
  }

  /**
   * Row filter that keeps the last-owner rule atomic with the write: the membership matches only when it is
   * not an owner (or stays one) or another owner remains. Evaluated in the same statement as the write, so
   * two owners demoting or removing each other concurrently cannot both succeed.
   */
  private keepsAnOwner(memberId: number, nextRole: WorkspaceRole | null) {
    const owners = alias(workspaceMemberships, "owners");
    const otherOwners = this.db
      .select({ value: count() })
      .from(owners)
      .where(and(eq(owners.workspaceId, this.workspaceId), eq(owners.role, "owner")));
    return and(
      eq(workspaceMemberships.workspaceId, this.workspaceId),
      eq(workspaceMemberships.memberId, memberId),
      nextRole === "owner" ? undefined : or(ne(workspaceMemberships.role, "owner"), gt(sql`(${otherOwners})`, 1)),
    );
  }

  private async isOwner(memberId: number) {
    const [row] = await this.db
      .select({ role: workspaceMemberships.role })
      .from(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, this.workspaceId), eq(workspaceMemberships.memberId, memberId)));
    return row?.role === "owner";
  }

  async setRole(memberId: number, role: WorkspaceRole) {
    const updated = await this.db.update(workspaceMemberships).set({ role }).where(this.keepsAnOwner(memberId, role)).returning({ id: workspaceMemberships.id });
    // Nothing matched: either the guard blocked it (still the only owner) or the membership is gone (no-op).
    return updated.length === 0 && (await this.isOwner(memberId)) ? ("last_owner" as const) : ("changed" as const);
  }

  async remove(memberId: number, now: Date) {
    const removed = await this.db.transaction(async (tx) => {
      // The guarded delete runs first, so the last-owner check and the write are one statement.
      const deleted = await tx.delete(workspaceMemberships).where(this.keepsAnOwner(memberId, null)).returning({ id: workspaceMemberships.id });
      const [kept] =
        deleted.length === 0
          ? await tx
              .select({ id: workspaceMemberships.id })
              .from(workspaceMemberships)
              .where(and(eq(workspaceMemberships.workspaceId, this.workspaceId), eq(workspaceMemberships.memberId, memberId)))
          : [];
      if (kept) return null;
      await tx.update(members).set({ removedAt: now }).where(and(eq(members.workspaceId, this.workspaceId), eq(members.id, memberId)));
      const unassigned = await tx
        .update(tasks)
        .set({ assigneeId: null, updatedAt: now })
        .where(and(eq(tasks.workspaceId, this.workspaceId), eq(tasks.assigneeId, memberId), ne(tasks.status, "completed")))
        .returning({ id: tasks.id });
      return { unassignedTasks: unassigned.length };
    });
    return removed ?? ("last_owner" as const);
  }

  async updateProfile(memberId: number, { title, avatarColor }: { title: string; avatarColor: AvatarColor | null }) {
    await this.db.update(members).set({ role: title, avatarColor }).where(and(this.active(), eq(members.id, memberId)));
  }

  async findUser(email: string) {
    const [row] = await this.db.select({ id: user.id, name: user.name }).from(user).where(eq(user.email, email));
    return row ?? null;
  }

  async pendingInvitations(now: Date): Promise<Invitation[]> {
    return this.db
      .select(invitationColumns)
      .from(workspaceInvitations)
      .leftJoin(members, eq(members.id, workspaceInvitations.invitedById))
      .where(and(eq(workspaceInvitations.workspaceId, this.workspaceId), isNull(workspaceInvitations.acceptedAt), gt(workspaceInvitations.expiresAt, now)))
      .orderBy(asc(workspaceInvitations.createdAt), asc(workspaceInvitations.id));
  }

  async createInvitation(invitation: NewInvitation, now: Date): Promise<Invitation> {
    const [row] = await this.db
      .insert(workspaceInvitations)
      .values({ ...invitation, workspaceId: this.workspaceId, createdAt: now })
      .returning({ id: workspaceInvitations.id });
    const [created] = await this.db
      .select(invitationColumns)
      .from(workspaceInvitations)
      .leftJoin(members, eq(members.id, workspaceInvitations.invitedById))
      .where(eq(workspaceInvitations.id, row!.id));
    return created!;
  }

  async revokeInvitationsFor(email: string) {
    await this.db
      .delete(workspaceInvitations)
      .where(and(eq(workspaceInvitations.workspaceId, this.workspaceId), eq(workspaceInvitations.email, email), isNull(workspaceInvitations.acceptedAt)));
  }

  async revokeInvitation(id: number) {
    const rows = await this.db
      .delete(workspaceInvitations)
      .where(and(eq(workspaceInvitations.workspaceId, this.workspaceId), eq(workspaceInvitations.id, id), isNull(workspaceInvitations.acceptedAt)))
      .returning({ id: workspaceInvitations.id });
    return rows.length > 0;
  }
}
