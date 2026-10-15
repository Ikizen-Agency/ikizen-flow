"use client";

import { useActionState } from "react";
import { FormAlert } from "@/modules/auth/ui/components/form-alert";
import { Button } from "@/shared/ui/button";
import { acceptInvitationAction, type AcceptInviteState } from "./invite-actions";

const INITIAL: AcceptInviteState = {};

export function AcceptInviteForm({ token, workspaceName }: { token: string; workspaceName: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-space-md">
      <input type="hidden" name="token" value={token} />
      {state.error ? <FormAlert message={state.error} /> : null}
      <Button type="submit" size="lg" icon="login" disabled={pending}>
        {pending ? "Joining..." : `Join ${workspaceName}`}
      </Button>
    </form>
  );
}
