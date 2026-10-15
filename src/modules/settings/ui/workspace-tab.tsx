import type { RequestContext } from "@/server/request-context";
import { Card, CardHeader } from "@/shared/ui/card";
import { Field, Input } from "@/shared/ui/input";
import { WORKSPACE_NAME_MAX_LENGTH, WORKSPACE_TAGLINE_MAX_LENGTH } from "../../workspaces/application/use-cases";
import { can } from "../../workspaces/domain/permissions";
import { updateWorkspaceAction } from "./actions";
import { ActionForm } from "./components/action-form";
import { DeleteWorkspace } from "./components/delete-workspace";

/** Workspace profile (owners and admins edit, members read) and the owner-only danger zone. */
export function WorkspaceTab({ ctx }: { ctx: RequestContext }) {
  const editable = can(ctx.role, "workspace.update");
  const deletable = can(ctx.role, "workspace.delete");
  const onlyWorkspace = ctx.memberships.length <= 1;
  return (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
      <Card className="flex flex-col gap-space-md lg:col-span-8">
        <CardHeader
          title="Workspace profile"
          description={editable ? "Shown in the sidebar, breadcrumbs and on invoices you send." : "Only owners and admins can change these details."}
        />
        <ActionForm action={updateWorkspaceAction} submitLabel="Save changes" icon="save" readOnly={!editable}>
          <Field label="Workspace name" htmlFor="ws-name">
            <Input id="ws-name" name="name" required maxLength={WORKSPACE_NAME_MAX_LENGTH} defaultValue={ctx.workspace.name} />
          </Field>
          <Field label="Tagline / description" htmlFor="ws-tagline" hint="A short description, e.g. “Digital Operations”.">
            <Input id="ws-tagline" name="tagline" maxLength={WORKSPACE_TAGLINE_MAX_LENGTH} defaultValue={ctx.workspace.tagline} />
          </Field>
          <Field label="URL name (slug)" htmlFor="ws-slug" hint="Lowercase letters, numbers and dashes; must be unique across Ikizen Flow.">
            <Input id="ws-slug" name="slug" maxLength={60} defaultValue={ctx.workspace.slug} />
          </Field>
        </ActionForm>
      </Card>
      <Card className="flex flex-col gap-space-sm lg:col-span-4" aria-labelledby="ws-facts">
        <h2 id="ws-facts" className="text-headline-sm text-ink">
          About this workspace
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-space-md gap-y-space-xs text-body-sm">
          <dt className="text-ink-subtle">Created</dt>
          <dd className="text-ink">{ctx.workspace.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</dd>
          <dt className="text-ink-subtle">Your access</dt>
          <dd className="text-ink capitalize">{ctx.role}</dd>
          <dt className="text-ink-subtle">Your workspaces</dt>
          <dd className="text-ink">{ctx.memberships.length}</dd>
        </dl>
      </Card>
      <Card className="flex flex-col gap-space-md border-danger-line lg:col-span-12" aria-labelledby="danger-zone">
        <h2 id="danger-zone" className="text-headline-sm text-danger-strong">
          Danger zone
        </h2>
        <DeleteWorkspace
          workspaceName={ctx.workspace.name}
          canDelete={deletable && !onlyWorkspace}
          blockedReason={
            !deletable
              ? "Only owners can delete the workspace."
              : onlyWorkspace
                ? "This is your only workspace. Create another workspace (sidebar switcher) before deleting this one."
                : null
          }
        />
      </Card>
    </div>
  );
}
