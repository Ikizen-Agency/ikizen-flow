"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { directory } from "@/server/container";
import { getSession } from "@/server/request-context";
import { setActiveWorkspace } from "../../workspaces/ui/active-workspace";
import { InvitationError } from "../domain/invitation";

export interface AcceptInviteState {
  error?: string;
}

const tokenSchema = z.object({ token: z.string().min(1).max(100) });

/** Joins the invited workspace (the signed-in email must match), makes it active and opens its overview. */
export async function acceptInvitationAction(_prev: AcceptInviteState, formData: FormData): Promise<AcceptInviteState> {
  const session = await getSession();
  const parsed = tokenSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) return { error: "This invitation link is not valid." };
  if (!session) redirect(`/login?next=${encodeURIComponent(`/invite/${parsed.data.token}`)}`);
  let workspaceId: number;
  try {
    ({ workspaceId } = await directory.acceptInvitation(parsed.data.token, session.user));
  } catch (error) {
    if (error instanceof InvitationError) return { error: error.message };
    console.error("acceptInvitation failed", error);
    return { error: "We could not accept the invitation. Please try again." };
  }
  await setActiveWorkspace(workspaceId);
  redirect("/");
}
