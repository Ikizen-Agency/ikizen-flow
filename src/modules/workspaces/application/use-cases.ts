import { NotFoundError, type Clock } from "../../shared-types";
import { assertCan } from "../domain/permissions";
import { defaultWorkspaceName, slugCandidate, slugify, type WorkspaceRole } from "../domain/workspace";
import type { WorkspaceDirectory } from "./ports";

export interface WorkspaceDeps {
  workspaces: WorkspaceDirectory;
  clock: Clock;
}

export const makeListMyWorkspaces =
  ({ workspaces }: Pick<WorkspaceDeps, "workspaces">) =>
  (userId: string) =>
    workspaces.listForUser(userId);

export interface ProvisionWorkspaceInput {
  userId: string;
  name: string;
  email: string;
  workspaceName?: string | null;
  tagline?: string | null;
}

const MAX_SLUG_ATTEMPTS = 50;

/** Registration step: gives a freshly created user their own workspace, as its owner. */
export const makeProvisionWorkspace =
  ({ workspaces, clock }: WorkspaceDeps) =>
  async ({ userId, name, email, workspaceName, tagline }: ProvisionWorkspaceInput) => {
    const workspace = workspaceName?.trim() || defaultWorkspaceName(name);
    const base = slugify(workspace);
    let slug: string | null = null;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !slug; attempt++) {
      const candidate = slugCandidate(base, attempt);
      if (!(await workspaces.slugExists(candidate))) slug = candidate;
    }
    slug ??= `${base}-${Date.now().toString(36)}`;
    return workspaces.createWithOwner(
      { name: workspace, slug, tagline: tagline?.trim() ?? "", owner: { userId, name: name.trim(), email: email.trim().toLowerCase(), title: "Owner" } },
      clock(),
    );
  };

export const WORKSPACE_NAME_MAX_LENGTH = 60;

export class InvalidWorkspaceNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidWorkspaceNameError";
  }
}

export interface CreateWorkspaceInput extends ProvisionWorkspaceInput {
  workspaceName: string;
}

/**
 * "Create workspace" from the switcher: the signed-in user gets an additional workspace they own.
 * Same provisioning as registration (unique slug, owner member profile and owner membership), but the name is required.
 */
export const makeCreateWorkspace = (deps: WorkspaceDeps) => {
  const provision = makeProvisionWorkspace(deps);
  return async (input: CreateWorkspaceInput) => {
    const workspaceName = input.workspaceName.trim();
    if (!workspaceName) throw new InvalidWorkspaceNameError("Workspace name is required.");
    if (workspaceName.length > WORKSPACE_NAME_MAX_LENGTH) {
      throw new InvalidWorkspaceNameError(`Workspace name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
    }
    return provision({ ...input, workspaceName });
  };
};

export const WORKSPACE_TAGLINE_MAX_LENGTH = 80;

export class WorkspaceSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceSettingsError";
  }
}

export class LastWorkspaceError extends Error {
  constructor() {
    super("This is your only workspace. Create another workspace before deleting this one.");
    this.name = "LastWorkspaceError";
  }
}

/** Workspace profile (name, tagline, slug). Owners and admins only; slugs are normalized and globally unique. */
export const makeUpdateWorkspace =
  ({ workspaces }: Pick<WorkspaceDeps, "workspaces">) =>
  async (actor: { workspaceId: number; role: WorkspaceRole }, input: { name: string; tagline: string; slug: string }) => {
    assertCan(actor.role, "workspace.update");
    const name = input.name.trim();
    const tagline = input.tagline.trim();
    if (!name) throw new WorkspaceSettingsError("Workspace name is required.");
    if (name.length > WORKSPACE_NAME_MAX_LENGTH) throw new WorkspaceSettingsError(`Workspace name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
    if (tagline.length > WORKSPACE_TAGLINE_MAX_LENGTH) throw new WorkspaceSettingsError(`Tagline must be at most ${WORKSPACE_TAGLINE_MAX_LENGTH} characters.`);
    const slug = slugify(input.slug.trim() || name);
    if (await workspaces.slugExists(slug, actor.workspaceId)) throw new WorkspaceSettingsError(`The URL name "${slug}" is already taken.`);
    return workspaces.update(actor.workspaceId, { name, tagline, slug });
  };

export interface AttachmentFileRemover {
  remove(key: string): Promise<void>;
}

/**
 * Permanently deletes the workspace and all its data (owners only). The owner must type the exact workspace
 * name, and cannot delete their only workspace (they would be left without one). Attachment files are
 * removed after the database delete; a file that cannot be removed is logged, never blocking.
 */
export const makeDeleteWorkspace =
  ({ workspaces, attachmentStorage }: Pick<WorkspaceDeps, "workspaces"> & { attachmentStorage?: AttachmentFileRemover }) =>
  async (actor: { workspaceId: number; role: WorkspaceRole; userId: string }, confirmName: string) => {
    assertCan(actor.role, "workspace.delete");
    const workspace = await workspaces.findById(actor.workspaceId);
    if (!workspace) throw new NotFoundError("Workspace", actor.workspaceId);
    if (confirmName.trim() !== workspace.name) throw new WorkspaceSettingsError(`Type the workspace name "${workspace.name}" exactly to confirm.`);
    const next = (await workspaces.listForUser(actor.userId)).find((m) => m.workspace.id !== actor.workspaceId);
    if (!next) throw new LastWorkspaceError();
    const files = await workspaces.delete(actor.workspaceId);
    for (const key of files) {
      await attachmentStorage?.remove(key).catch((error: unknown) => console.error("Could not delete attachment file", key, error));
    }
    return { nextWorkspaceId: next.workspace.id };
  };
