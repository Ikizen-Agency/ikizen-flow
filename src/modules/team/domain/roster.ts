import { assignableRoles, can } from "../../workspaces/domain/permissions";
import type { WorkspaceRole } from "../../workspaces/domain/workspace";
import type { Member } from "./member";

/** One person on the workspace roster: their member profile and, when they can sign in, their access level. */
export interface RosterEntry {
  member: Member;
  /** Access level, or null for teammates without a login (assignable to tasks, cannot sign in). */
  role: WorkspaceRole | null;
  createdAt: Date;
}

/** Who performs a team change. */
export interface TeamActor {
  memberId: number;
  role: WorkspaceRole;
}

/** A business rule refused the change (last owner, self-removal, duplicates...). */
export class TeamRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamRuleError";
  }
}

const LAST_OWNER = "A workspace needs at least one owner. Make someone else an owner first.";

/** Why `actor` cannot change `target` to `next` (null when allowed). */
export function roleChangeBlockedReason(actor: TeamActor, target: RosterEntry, next: WorkspaceRole, ownerCount: number): string | null {
  if (!can(actor.role, "members.manage")) return "Only owners and admins can change roles.";
  if (!target.role) return "Teammates without a login have no access level. Invite them by email to give them access.";
  if (target.role === next) return null;
  if (target.role === "owner" && actor.role !== "owner") return "Only owners can change an owner's role.";
  if (!assignableRoles(actor.role).includes(next)) return "Only owners can make someone an owner.";
  if (target.role === "owner" && ownerCount <= 1) return LAST_OWNER;
  return null;
}

/** Why `actor` cannot remove `target` from the workspace (null when allowed). */
export function removalBlockedReason(actor: TeamActor, target: RosterEntry, ownerCount: number): string | null {
  if (!can(actor.role, "members.manage")) return "Only owners and admins can remove members.";
  if (target.member.id === actor.memberId) return "You cannot remove yourself. Ask another owner or admin.";
  if (target.role === "owner" && actor.role !== "owner") return "Only owners can remove an owner.";
  if (target.role === "owner" && ownerCount <= 1) return LAST_OWNER;
  return null;
}

/** Trimmed, lower-cased email used to match members, users and invitations. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
