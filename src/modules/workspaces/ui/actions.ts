"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ACTIVE_WORKSPACE_COOKIE, requireRequestContext } from "@/server/request-context";

const switchSchema = z.object({ workspaceId: z.coerce.number().int().positive() });

/** Makes another of the user's workspaces active. Ids the user is not a member of are ignored. */
export async function switchWorkspaceAction(formData: FormData): Promise<void> {
  const ctx = await requireRequestContext();
  const parsed = switchSchema.safeParse({ workspaceId: formData.get("workspaceId") });
  const target = parsed.success ? ctx.memberships.find((m) => m.workspace.id === parsed.data.workspaceId) : undefined;
  if (target) {
    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, String(target.workspace.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath("/", "layout");
  }
  redirect("/");
}
