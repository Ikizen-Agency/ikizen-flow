import type { WorkspaceApp } from "@/server/container";
import type { RequestContext } from "@/server/request-context";
import { formatDate } from "@/shared/domain/time";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Card, CardHeader } from "@/shared/ui/card";
import { Table, TD, TH, THead, TR } from "@/shared/ui/data-table";
import { Field, Input, Select } from "@/shared/ui/input";
import { JOB_TITLE_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "../../team/domain/member";
import { removalBlockedReason, roleChangeBlockedReason } from "../../team/domain/roster";
import { assignableRoles, can } from "../../workspaces/domain/permissions";
import { WORKSPACE_ROLE_LABELS, WORKSPACE_ROLES } from "../../workspaces/domain/workspace";
import { addTeammateAction, inviteMemberAction, revokeInvitationAction } from "./actions";
import { ActionButton, ActionForm } from "./components/action-form";
import { RemoveMemberButton, RoleSelect } from "./components/member-controls";

/** Roster with access levels, pending invitations, and (for owners / admins) add, invite, role and remove controls. */
export async function MembersTab({ ctx, app }: { ctx: RequestContext; app: WorkspaceApp }) {
  const { members, invitations } = await app.team.roster();
  const manager = can(ctx.role, "members.manage");
  const actor = { memberId: ctx.member.id, role: ctx.role };
  const owners = members.filter((m) => m.role === "owner").length;
  /** Roles the actor may move this entry to (the current one included); mirrors the use case rules. */
  const roleOptions = (entry: (typeof members)[number]) => WORKSPACE_ROLES.filter((r) => r === entry.role || !roleChangeBlockedReason(actor, entry, r, owners));

  return (
    <div className="flex flex-col gap-gutter">
      <Card flush aria-labelledby="roster-title">
        <div className="flex flex-col gap-1 p-5">
          <h2 id="roster-title" className="text-headline-sm text-ink">
            Team ({members.length})
          </h2>
          <p className="text-body-sm text-ink-subtle">
            Members with a login can sign in with their access level. Teammates without a login can be assigned to tasks only. Removing someone revokes access and
            unassigns their open tasks; their name stays on past activity, comments and completed work.
          </p>
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Job title</TH>
              <TH>Login</TH>
              <TH>Access</TH>
              <TH>Added</TH>
              <TH align="right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <tbody>
            {members.map((entry) => {
              const { member, role } = entry;
              const removable = manager && !removalBlockedReason(actor, entry, owners);
              const self = member.id === ctx.member.id;
              return (
                <TR key={member.id}>
                  <TD>
                    <div className="flex items-center gap-space-sm">
                      <Avatar name={member.name} color={member.avatarColor} />
                      <div className="min-w-0">
                        <p className="truncate text-label-md text-ink">
                          {member.name}
                          {self ? <span className="ml-1 text-body-sm text-ink-subtle">(you)</span> : null}
                        </p>
                        <p className="truncate text-body-sm text-ink-subtle">{member.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD>{member.role}</TD>
                  <TD>{member.userId ? <Badge tone="success">Can sign in</Badge> : <Badge tone="neutral">No login</Badge>}</TD>
                  <TD>
                    {role && manager && !self && (role !== "owner" || ctx.role === "owner") ? (
                      <RoleSelect memberId={member.id} role={role} name={member.name} options={roleOptions(entry)} />
                    ) : role ? (
                      <Badge tone={role === "owner" ? "info" : "neutral"}>{WORKSPACE_ROLE_LABELS[role]}</Badge>
                    ) : (
                      <span className="text-body-sm text-ink-subtle">Task assignment only</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">{formatDate(entry.createdAt)}</TD>
                  <TD align="right">{removable ? <RemoveMemberButton memberId={member.id} name={member.name} /> : null}</TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card className="flex flex-col gap-space-md" aria-labelledby="invites-title">
        <h2 id="invites-title" className="text-headline-sm text-ink">
          Pending invitations ({invitations.length})
        </h2>
        {invitations.length === 0 ? (
          <p className="text-body-sm text-ink-subtle">No pending invitations.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-space-sm py-space-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-label-md text-ink">{inv.email}</p>
                  <p className="text-body-sm text-ink-subtle">
                    {WORKSPACE_ROLE_LABELS[inv.role]} · invited by {inv.invitedByName ?? "a former member"} on {formatDate(inv.createdAt)} · expires {formatDate(inv.expiresAt)}
                  </p>
                </div>
                {manager ? <ActionButton action={revokeInvitationAction} label="Revoke" icon="link_off" pendingLabel="Revoking..." fields={{ invitationId: inv.id }} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {manager ? (
        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
          <Card className="flex flex-col gap-space-md">
            <CardHeader title="Invite by email" description="People who already have an Ikizen Flow account join right away; others receive an invite link valid for 7 days." />
            <ActionForm action={inviteMemberAction} submitLabel="Send invitation" pendingLabel="Inviting..." icon="forward_to_inbox" resetOnSuccess>
              <Field label="Email" htmlFor="invite-email">
                <Input id="invite-email" name="email" type="email" required autoComplete="off" placeholder="name@company.com" />
              </Field>
              <Field label="Access level" htmlFor="invite-role">
                <Select id="invite-role" name="role" defaultValue="member">
                  {assignableRoles(ctx.role).map((r) => (
                    <option key={r} value={r}>
                      {WORKSPACE_ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            </ActionForm>
          </Card>
          <Card className="flex flex-col gap-space-md">
            <CardHeader title="Add a teammate without a login" description="For people you assign tasks to who do not need to sign in (contractors, freelancers)." />
            <ActionForm action={addTeammateAction} submitLabel="Add teammate" pendingLabel="Adding..." icon="person_add" resetOnSuccess>
              <Field label="Name" htmlFor="mate-name">
                <Input id="mate-name" name="name" required maxLength={MEMBER_NAME_MAX_LENGTH} autoComplete="off" />
              </Field>
              <Field label="Email" htmlFor="mate-email">
                <Input id="mate-email" name="email" type="email" required autoComplete="off" />
              </Field>
              <Field label="Job title" htmlFor="mate-title">
                <Input id="mate-title" name="title" maxLength={JOB_TITLE_MAX_LENGTH} placeholder="Teammate" />
              </Field>
            </ActionForm>
          </Card>
        </div>
      ) : (
        <p className="text-body-sm text-ink-subtle">Only owners and admins can invite people, add teammates or change access levels.</p>
      )}
    </div>
  );
}
