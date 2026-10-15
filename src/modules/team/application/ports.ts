import type { AvatarColor } from "@/shared/domain/avatar-colors";
import type { WorkspaceRole } from "../../workspaces/domain/workspace";
import type { Invitation } from "../domain/invitation";
import type { Member } from "../domain/member";
import type { RosterEntry } from "../domain/roster";

/** Active members of one workspace (the adapter is constructed for a workspace). Removed members are excluded. */
export interface MemberRepository {
  list(): Promise<Member[]>;
  findById(id: number): Promise<Member | null>;
}

export interface NewTeammate {
  name: string;
  email: string;
  title: string;
}

export interface NewInvitation {
  email: string;
  role: WorkspaceRole;
  tokenHash: string;
  invitedById: number | null;
  expiresAt: Date;
}

/** Team management of one workspace: roster, access levels, removal and invitations. */
export interface TeamRepository {
  /** Active members (with their access level when they have a login), oldest first. */
  roster(): Promise<RosterEntry[]>;
  findEntry(memberId: number): Promise<RosterEntry | null>;
  findEntryByEmail(email: string): Promise<RosterEntry | null>;
  ownerCount(): Promise<number>;
  /** Creates a teammate without a login, or restores a removed member with the same email. */
  addTeammate(teammate: NewTeammate, now: Date): Promise<Member>;
  /** Gives a user access: links (or restores / creates) the member row for their email and adds the membership. */
  grantAccess(input: { userId: string; name: string; email: string; role: WorkspaceRole }, now: Date): Promise<Member>;
  /**
   * Changes the access level. The last-owner rule is re-checked atomically with the write, so two owners
   * demoting each other concurrently cannot leave the workspace without one: "last_owner" means nothing changed.
   */
  setRole(memberId: number, role: WorkspaceRole): Promise<"changed" | "last_owner">;
  /**
   * Soft-removes the member, deletes their membership and unassigns their open tasks (one transaction).
   * "last_owner" (nothing changed) when the member is the only owner, re-checked inside the transaction.
   */
  remove(memberId: number, now: Date): Promise<{ unassignedTasks: number } | "last_owner">;
  updateProfile(memberId: number, profile: { title: string; avatarColor: AvatarColor | null }): Promise<void>;
  /** The Better Auth user with this email, if any. */
  findUser(email: string): Promise<{ id: string; name: string } | null>;
  pendingInvitations(now: Date): Promise<Invitation[]>;
  createInvitation(invitation: NewInvitation, now: Date): Promise<Invitation>;
  /** Deletes pending invitations for the email (re-inviting replaces the previous link). */
  revokeInvitationsFor(email: string): Promise<void>;
  revokeInvitation(id: number): Promise<boolean>;
}

/** Invitations looked up by token, across workspaces (the invitee is not a member yet). */
export interface InvitationDirectory {
  findByTokenHash(tokenHash: string): Promise<{ invitation: Invitation; workspace: { id: number; name: string } } | null>;
  /**
   * Grants access and marks the invitation accepted atomically. "already_used" when it was accepted
   * concurrently; "already_member" when the user already belongs to the workspace (nothing changes and the
   * invitation stays pending, so a stale invite can never change an existing member's role).
   */
  accept(invitationId: number, user: { id: string; name: string; email: string }, now: Date): Promise<"accepted" | "already_used" | "already_member">;
}
