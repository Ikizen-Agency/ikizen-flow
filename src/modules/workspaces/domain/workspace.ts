/** Access levels inside a workspace. Job titles ("Operations Manager") live on the member profile. */
export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  createdAt: Date;
}

/** URL-safe identifier derived from a workspace name. */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "workspace";
}

/** `attempt` 0 is the base slug; later attempts are suffixed `-2`, `-3`, ... */
export function slugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

export function defaultWorkspaceName(ownerName: string): string {
  const first = ownerName.trim().split(/\s+/)[0];
  return first ? `${first}'s Workspace` : "My Workspace";
}

/**
 * Chooses the active workspace: the requested one (e.g. from a cookie) when the user belongs to it,
 * otherwise the first membership. Never trusts an id the user is not a member of.
 */
export function pickActiveMembership<T extends { workspace: { id: number } }>(memberships: readonly T[], requestedId: string | undefined): T | null {
  const id = requestedId && /^\d+$/.test(requestedId) ? Number(requestedId) : null;
  return memberships.find((m) => m.workspace.id === id) ?? memberships[0] ?? null;
}
