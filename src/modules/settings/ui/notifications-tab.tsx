import type { WorkspaceApp } from "@/server/container";
import type { RequestContext } from "@/server/request-context";
import { Card, CardHeader } from "@/shared/ui/card";
import { Table, TD, TH, THead, TR } from "@/shared/ui/data-table";
import { NOTIFICATION_TYPE_LABELS } from "../../notifications/domain/preferences";
import { saveNotificationPreferencesAction } from "./actions";
import { ActionForm } from "./components/action-form";

/** Per-type delivery choices of the signed-in member in this workspace (in-app bell and email). */
export async function NotificationsTab({ ctx, app }: { ctx: RequestContext; app: WorkspaceApp }) {
  const preferences = await app.notifications.preferences(ctx.member.id);
  return (
    <Card className="flex flex-col gap-space-md">
      <CardHeader
        title="Notification preferences"
        description={`Choose what reaches you in ${ctx.workspace.name}. Emails go to ${ctx.member.email} through the workspace outbox.`}
      />
      <ActionForm action={saveNotificationPreferencesAction} submitLabel="Save preferences" icon="save">
        <Table>
          <THead>
            <tr>
              <TH>Notification</TH>
              <TH align="center">In-app</TH>
              <TH align="center">Email</TH>
            </tr>
          </THead>
          <tbody>
            {preferences.map((p) => {
              const { label, description } = NOTIFICATION_TYPE_LABELS[p.type];
              return (
                <TR key={p.type}>
                  <TD>
                    <p className="text-label-md text-ink">{label}</p>
                    <p className="text-body-sm text-ink-subtle">{description}</p>
                  </TD>
                  <TD align="center">
                    <input type="checkbox" name={`inApp:${p.type}`} defaultChecked={p.inApp} aria-label={`${label} in-app`} className="size-4 accent-accent" />
                  </TD>
                  <TD align="center">
                    <input type="checkbox" name={`email:${p.type}`} defaultChecked={p.email} aria-label={`${label} by email`} className="size-4 accent-accent" />
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </ActionForm>
    </Card>
  );
}
