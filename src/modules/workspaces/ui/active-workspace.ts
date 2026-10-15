import "server-only";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/request-context";

/** Remembers the active workspace (only a hint: the request context re-checks membership on every request). */
export async function setActiveWorkspace(workspaceId: number) {
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, String(workspaceId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
