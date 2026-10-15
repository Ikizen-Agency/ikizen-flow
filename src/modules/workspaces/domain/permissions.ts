import type { WorkspaceRole } from "./workspace";

/**
 * What each access level may do in a workspace. Use cases enforce these rules (the UI only mirrors them).
 * - Owners: everything, including deleting the workspace and granting / revoking ownership.
 * - Admins: workspace profile, members (except owners), invitations, email outbox.
 * - Members: read-only workspace settings; their own profile and notification preferences.
 */
export type WorkspaceAction = "workspace.update" | "workspace.delete" | "members.manage" | "mail.manage";

const RULES: Record<WorkspaceAction, ReadonlyArray<WorkspaceRole>> = {
  "workspace.update": ["owner", "admin"],
  "workspace.delete": ["owner"],
  "members.manage": ["owner", "admin"],
  "mail.manage": ["owner", "admin"],
};

const MESSAGES: Record<WorkspaceAction, string> = {
  "workspace.update": "Only owners and admins can edit the workspace.",
  "workspace.delete": "Only owners can delete the workspace.",
  "members.manage": "Only owners and admins can manage members.",
  "mail.manage": "Only owners and admins can manage workspace email.",
};

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function can(role: WorkspaceRole, action: WorkspaceAction): boolean {
  return RULES[action].includes(role);
}

export function assertCan(role: WorkspaceRole, action: WorkspaceAction): void {
  if (!can(role, action)) throw new ForbiddenError(MESSAGES[action]);
}

/** Access levels an actor may grant (invite with, or change someone to). */
export function assignableRoles(actor: WorkspaceRole): WorkspaceRole[] {
  if (actor === "owner") return ["owner", "admin", "member"];
  if (actor === "admin") return ["admin", "member"];
  return [];
}
