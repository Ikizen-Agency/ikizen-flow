"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { directory } from "@/server/container";
import { ACTIVE_WORKSPACE_COOKIE, requireRequestContext } from "@/server/request-context";
import { InvalidWorkspaceNameError, WORKSPACE_NAME_MAX_LENGTH } from "../application/use-cases";

const switchSchema = z.object({ workspaceId: z.coerce.number().int().positive() });

/** Makes another of the user's workspaces active. Ids the user is not a member of are ignored. */
export async function switchWorkspaceAction(formData: FormData): Promise<void> {
  const ctx = await requireRequestContext();
  const parsed = switchSchema.safeParse({ workspaceId: formData.get("workspaceId") });
  const target = parsed.success ? ctx.memberships.find((m) => m.workspace.id === parsed.data.workspaceId) : undefined;
  if (target) await activateWorkspace(target.workspace.id);
  redirect("/");
}

async function activateWorkspace(workspaceId: number) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, String(workspaceId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required.").max(WORKSPACE_NAME_MAX_LENGTH, `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`),
  tagline: z.string().trim().max(80, "Use at most 80 characters.").optional(),
});

export interface CreateWorkspaceState {
  error?: string;
  values?: { name: string; tagline: string };
}

/**
 * Creates a new workspace owned by the signed-in user (same provisioning as registration),
 * makes it active and opens its overview.
 */
export async function createWorkspaceAction(_prev: CreateWorkspaceState, formData: FormData): Promise<CreateWorkspaceState> {
  const ctx = await requireRequestContext();
  const values = { name: String(formData.get("name") ?? ""), tagline: String(formData.get("tagline") ?? "") };
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid workspace.", values };
  let workspaceId: number;
  try {
    const created = await directory.createWorkspace({
      userId: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      workspaceName: parsed.data.name,
      tagline: parsed.data.tagline ?? null,
    });
    workspaceId = created.workspace.id;
  } catch (error) {
    if (error instanceof InvalidWorkspaceNameError) return { error: error.message, values };
    throw error;
  }
  await activateWorkspace(workspaceId);
  redirect("/");
}
