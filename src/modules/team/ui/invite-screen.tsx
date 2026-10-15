import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { signOutAction } from "@/modules/auth/ui/actions";
import { AuthCard } from "@/modules/auth/ui/components/auth-card";
import { FormAlert } from "@/modules/auth/ui/components/form-alert";
import { directory } from "@/server/container";
import { getSession } from "@/server/request-context";
import { formatDate } from "@/shared/domain/time";
import { buttonClasses } from "@/shared/ui/button";
import { WORKSPACE_ROLE_LABELS } from "../../workspaces/domain/workspace";
import { InvitationError } from "../domain/invitation";
import { AcceptInviteForm } from "./accept-invite-form";

const footer = (
  <Link href="/" className="text-label-md text-accent hover:underline">
    Go to Ikizen Flow
  </Link>
);

/** /invite/<token>: who invited you to which workspace, and the Join button when the signed-in email matches. */
export async function InviteScreen({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  let view: Awaited<ReturnType<typeof directory.invitation>>;
  try {
    view = await directory.invitation(token, session.user);
  } catch (error) {
    if (!(error instanceof InvitationError)) throw error;
    return (
      <AuthCard title="Invitation not found" description="The link is invalid or the invitation was revoked." footer={footer}>
        <FormAlert message={error.message} />
      </AuthCard>
    );
  }
  const { workspace, invitation, blocked } = view;
  const alreadyMember = (await directory.listMyWorkspaces(session.user.id)).some((m) => m.workspace.id === workspace.id);
  const role = WORKSPACE_ROLE_LABELS[invitation.role].toLowerCase();

  return (
    <AuthCard
      title={`Join ${workspace.name}`}
      description={`${invitation.invitedByName ?? "A workspace admin"} invited ${invitation.email} as ${role === "admin" ? "an" : "a"} ${role}. Expires ${formatDate(invitation.expiresAt)}.`}
      footer={footer}
    >
      <div className="flex flex-col gap-space-md">
        {alreadyMember && !blocked ? <FormAlert tone="info" message={`You are already a member of ${workspace.name}. Joining again updates your access level.`} /> : null}
        {blocked ? (
          <>
            <FormAlert message={blocked.message} />
            {blocked.reason === "email_mismatch" ? (
              <form action={signOutAction}>
                <button type="submit" className={buttonClasses({ variant: "secondary", className: "w-full" })}>
                  Sign out ({session.user.email})
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <AcceptInviteForm token={token} workspaceName={workspace.name} />
        )}
      </div>
    </AuthCard>
  );
}
