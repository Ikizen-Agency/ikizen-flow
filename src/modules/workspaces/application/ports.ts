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
  /** True when another workspace (not `exceptId`) already uses the slug. */
  slugExists(slug: string, exceptId?: number): Promise<boolean>;
  findById(id: number): Promise<Workspace | null>;
  update(id: number, changes: { name: string; slug: string; tagline: string }): Promise<Workspace>;
  /** Deletes the workspace and all its data; returns the storage keys of its task attachments (to delete the files). */
  delete(id: number): Promise<string[]>;
  /** Renames the member profiles linked to a user in every workspace (the account name changed). */
  renameUserMembers(userId: string, name: string): Promise<void>;
  /** Creates the workspace, the owner's member profile and the owner membership atomically. */
  createWithOwner(input: NewWorkspaceWithOwner, now: Date): Promise<WorkspaceMembership>;
}
