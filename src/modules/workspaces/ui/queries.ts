import "server-only";
import { requireRequestContext } from "@/server/request-context";
import { WORKSPACE_ROLE_LABELS } from "../domain/workspace";

export interface WorkspaceOption {
  id: number;
  name: string;
  tagline: string;
  roleLabel: string;
  active: boolean;
}

/** Workspaces of the signed-in user, for the switcher (active one flagged). */
export async function listMyWorkspaces(): Promise<WorkspaceOption[]> {
  const ctx = await requireRequestContext();
  return ctx.memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    tagline: m.workspace.tagline,
    roleLabel: WORKSPACE_ROLE_LABELS[m.role],
    active: m.workspace.id === ctx.workspace.id,
  }));
}
