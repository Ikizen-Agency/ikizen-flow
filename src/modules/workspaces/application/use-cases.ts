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
