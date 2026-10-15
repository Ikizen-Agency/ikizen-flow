import type { Member } from "../../team/domain/member";
import type { Workspace, WorkspaceRole } from "../domain/workspace";

/** A user's seat in a workspace: the workspace, their access level and their member profile there. */
export interface WorkspaceMembership {
  workspace: Workspace;
  role: WorkspaceRole;
  member: Member;
}

export interface NewWorkspaceWithOwner {
  name: string;
  slug: string;
  tagline: string;
  owner: { userId: string; name: string; email: string; title: string };
}

/** Tenant directory. Unlike business repositories it is not scoped to one workspace. */
export interface WorkspaceDirectory {
  /** Memberships of a user, oldest workspace first. */
  listForUser(userId: string): Promise<WorkspaceMembership[]>;
  slugExists(slug: string): Promise<boolean>;
  /** Creates the workspace, the owner's member profile and the owner membership atomically. */
  createWithOwner(input: NewWorkspaceWithOwner, now: Date): Promise<WorkspaceMembership>;
}
