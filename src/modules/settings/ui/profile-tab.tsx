import type { RequestContext } from "@/server/request-context";
import { AVATAR_COLOR_LABELS, AVATAR_COLORS } from "@/shared/domain/avatar-colors";
import { Avatar } from "@/shared/ui/avatar";
import { Card, CardHeader } from "@/shared/ui/card";
import { Field, Input } from "@/shared/ui/input";
import { JOB_TITLE_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "../../team/domain/member";
import { changePasswordAction, updateProfileAction } from "./actions";
import { ActionForm } from "./components/action-form";

/** The signed-in person: name, job title, avatar colour and password. */
export function ProfileTab({ ctx }: { ctx: RequestContext }) {
  const current = ctx.member.avatarColor ?? "";
  return (
    <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
      <Card className="flex flex-col gap-space-md">
        <CardHeader title="Your profile" description="Your name is used in every workspace; job title and avatar colour apply to this workspace." />
        <div className="flex items-center gap-space-md">
          <Avatar name={ctx.member.name} color={ctx.member.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-label-md text-ink">{ctx.member.name}</p>
            <p className="truncate text-body-sm text-ink-subtle">{ctx.user.email}</p>
          </div>
        </div>
        <ActionForm action={updateProfileAction} submitLabel="Save profile" icon="save">
          <Field label="Full name" htmlFor="profile-name">
            <Input id="profile-name" name="name" required maxLength={MEMBER_NAME_MAX_LENGTH} defaultValue={ctx.member.name} autoComplete="name" />
          </Field>
          <Field label="Job title" htmlFor="profile-title">
            <Input id="profile-title" name="title" required maxLength={JOB_TITLE_MAX_LENGTH} defaultValue={ctx.member.role} />
          </Field>
          <Field label="Email" htmlFor="profile-email" hint="Your sign-in email cannot be changed here.">
            <Input id="profile-email" value={ctx.user.email} readOnly disabled />
          </Field>
          <fieldset className="flex flex-col gap-space-xs">
            <legend className="mb-1.5 text-label-md text-ink-muted">Avatar colour</legend>
            <div className="flex flex-wrap gap-space-sm">
              <label className="flex cursor-pointer items-center gap-space-xs rounded-control border border-line px-space-sm py-1 text-body-sm has-checked:border-accent has-checked:bg-accent-tint">
                <input type="radio" name="avatarColor" value="" defaultChecked={current === ""} className="accent-accent" />
                Automatic
              </label>
              {AVATAR_COLORS.map((color) => (
                <label
                  key={color}
                  className="flex cursor-pointer items-center gap-space-xs rounded-control border border-line px-space-sm py-1 text-body-sm has-checked:border-accent has-checked:bg-accent-tint"
                >
                  <input type="radio" name="avatarColor" value={color} defaultChecked={current === color} className="accent-accent" />
                  <Avatar name={ctx.member.name} color={color} size="xs" />
                  {AVATAR_COLOR_LABELS[color]}
                </label>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </Card>
      <Card className="flex flex-col gap-space-md">
        <CardHeader title="Change password" description="At least 8 characters. You stay signed in on this device." />
        <ActionForm action={changePasswordAction} submitLabel="Change password" pendingLabel="Changing..." icon="lock_reset" resetOnSuccess>
          <Field label="Current password" htmlFor="pw-current">
            <Input id="pw-current" name="currentPassword" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="New password" htmlFor="pw-new">
            <Input id="pw-new" name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm">
            <Input id="pw-confirm" name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
          </Field>
          <label className="flex items-center gap-space-sm text-body-sm text-ink-muted">
            <input type="checkbox" name="revokeOtherSessions" className="size-4 accent-accent" />
            Sign out of all other sessions
          </label>
        </ActionForm>
      </Card>
    </div>
  );
}
