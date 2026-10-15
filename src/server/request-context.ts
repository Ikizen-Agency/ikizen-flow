import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Member } from "@/modules/team/domain/member";
import type { WorkspaceMembership } from "@/modules/workspaces/application/ports";
import { pickActiveMembership, type Workspace, type WorkspaceRole } from "@/modules/workspaces/domain/workspace";
import { auth } from "./auth";
import { directory, forWorkspace, type WorkspaceApp } from "./container";

/** Cookie holding the active workspace id. Only a hint: it is always validated against memberships. */
export const ACTIVE_WORKSPACE_COOKIE = "ikizen_workspace";

export interface RequestContext {
  user: { id: string; name: string; email: string; image: string | null };
  /** Active workspace (from the cookie when valid, else the user's first workspace). */
  workspace: Workspace;
  role: WorkspaceRole;
  /** The signed-in user's member profile in the active workspace (actor of every mutation). */
  member: Member;
  /** Every workspace the user belongs to (for the switcher). */
  memberships: WorkspaceMembership[];
}

/** Current Better Auth session (database-backed), memoised per request. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/**
 * Who is calling and in which workspace, or null when signed out (or the user has no workspace).
 * Server-only and memoised per request: pages, layouts, Server Actions and Route Handlers can all call it.
 */
export const getRequestContext = cache(async (): Promise<RequestContext | null> => {
  const session = await getSession();
  if (!session) return null;
  const memberships = await directory.listMyWorkspaces(session.user.id);
  const active = pickActiveMembership(memberships, (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value);
  if (!active) return null;
  const { id, name, email, image } = session.user;
  return { user: { id, name, email, image: image ?? null }, workspace: active.workspace, role: active.role, member: active.member, memberships };
});

/** Like `getRequestContext`, but redirects to the login page (keeping `next`) when there is no session. */
export async function requireRequestContext(next?: string): Promise<RequestContext> {
  const context = await getRequestContext();
  if (context) return context;
  if (await getSession()) redirect("/login?error=no_workspace");
  redirect(next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login");
}

/** Session context plus the use cases bound to the active workspace. Redirects to login when signed out. */
export const getWorkspaceApp = cache(async (next?: string): Promise<{ ctx: RequestContext; app: WorkspaceApp }> => {
  const ctx = await requireRequestContext(next);
  return { ctx, app: forWorkspace(ctx.workspace.id) };
});

/** Route Handler guard: 401 JSON response when unauthenticated, otherwise context + workspace use cases. */
export async function authorizeRoute(): Promise<{ ctx: RequestContext; app: WorkspaceApp } | Response> {
  const ctx = await getRequestContext();
  if (!ctx) {
    return Response.json({ error: "unauthorized", message: "Sign in to access this resource." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return { ctx, app: forWorkspace(ctx.workspace.id) };
}
