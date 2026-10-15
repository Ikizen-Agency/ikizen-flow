import type { Clock } from "../../shared-types";
import { defaultWorkspaceName, slugCandidate, slugify } from "../domain/workspace";
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
