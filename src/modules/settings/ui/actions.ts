"use server";

import { isAPIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { directory } from "@/server/container";
import { getWorkspaceApp } from "@/server/request-context";
import { EmailRetryError, InvalidEmailError, type OutboxEmail } from "../../mail/domain/email";
import { NotFoundError } from "../../shared-types";
import { TeamRuleError } from "../../team/domain/roster";
import { LastWorkspaceError, WorkspaceSettingsError } from "../../workspaces/application/use-cases";
import { ForbiddenError } from "../../workspaces/domain/permissions";
import { setActiveWorkspace } from "../../workspaces/ui/active-workspace";
import {
  deleteWorkspaceSchema,
  emailIdSchema,
  firstIssue,
  invitationIdSchema,
  inviteSchema,
  memberIdSchema,
  passwordSchema,
  preferencesFromForm,
  profileSchema,
  roleSchema,
  teammateSchema,
  workspaceSchema,
  type SettingsActionState,
} from "./form-schema";

const KNOWN_ERRORS = [ForbiddenError, TeamRuleError, WorkspaceSettingsError, LastWorkspaceError, NotFoundError, EmailRetryError, InvalidEmailError];

/** Business and permission errors become inline messages; anything else is logged and reported generically. */
async function run(label: string, work: () => Promise<SettingsActionState>): Promise<SettingsActionState> {
  try {
    return await work();
  } catch (error) {
    if (KNOWN_ERRORS.some((E) => error instanceof E)) return { status: "error", message: (error as Error).message };
    console.error(`${label} failed`, error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const values = (formData: FormData) => Object.fromEntries(formData);

function revalidateSettings() {
  revalidatePath("/settings");
}

async function actor() {
  const { ctx, app } = await getWorkspaceApp();
  return { ctx, app, actor: { memberId: ctx.member.id, role: ctx.role } };
}

// --- Workspace -------------------------------------------------------------

export async function updateWorkspaceAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { ctx } = await getWorkspaceApp();
  const parsed = workspaceSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  return run("updateWorkspace", async () => {
    const updated = await directory.updateWorkspace({ workspaceId: ctx.workspace.id, role: ctx.role }, parsed.data);
    revalidatePath("/", "layout");
    return { status: "success", message: `Saved. The workspace URL name is "${updated.slug}".` };
  });
}

/** Deletes the active workspace (owners only, typed confirmation) and switches to the user's next workspace. */
export async function deleteWorkspaceAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { ctx } = await getWorkspaceApp();
  const parsed = deleteWorkspaceSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: "Type the workspace name to confirm." };
  let nextWorkspaceId: number | null = null;
  const result = await run("deleteWorkspace", async () => {
    ({ nextWorkspaceId } = await directory.deleteWorkspace({ workspaceId: ctx.workspace.id, role: ctx.role, userId: ctx.user.id }, parsed.data.confirmName));
    return { status: "success" };
  });
  if (result.status === "error" || nextWorkspaceId === null) return result;
  await setActiveWorkspace(nextWorkspaceId);
  redirect("/");
}

// --- Members ---------------------------------------------------------------

export async function addTeammateAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { app, actor: who } = await actor();
  const parsed = teammateSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  return run("addTeammate", async () => {
    const member = await app.team.addTeammate(who, parsed.data);
    revalidateSettings();
    revalidatePath("/tasks");
    return { status: "success", message: `${member.name} was added. They can be assigned to tasks but cannot sign in.` };
  });
}

function inviteMessage(email: OutboxEmail, to: string): SettingsActionState {
  if (email.status === "sent") return { status: "success", message: `Invitation emailed to ${to}.` };
  if (email.status === "failed") return { status: "error", message: `The invitation was created, but emailing ${to} failed: ${email.error ?? "unknown error"}. Retry it from the Email tab.` };
  return { status: "success", message: `Invitation created for ${to}. SMTP is not configured, so the email is only in the outbox (Email tab).` };
}

export async function inviteMemberAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { ctx, app, actor: who } = await actor();
  const parsed = inviteSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  return run("inviteMember", async () => {
    const result = await app.team.invite(who, parsed.data, { workspaceName: ctx.workspace.name, inviterName: ctx.member.name, baseUrl: directory.baseUrl });
    revalidateSettings();
    if (result.kind === "added") return { status: "success", message: `${result.member.name} already had an account and was added to ${ctx.workspace.name}.` };
    return inviteMessage(result.email, parsed.data.email);
  });
}

export async function revokeInvitationAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { app, actor: who } = await actor();
  const parsed = invitationIdSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: "Unknown invitation." };
  return run("revokeInvitation", async () => {
    await app.team.revokeInvitation(who, parsed.data.invitationId);
    revalidateSettings();
    return { status: "success", message: "Invitation revoked." };
  });
}

export async function changeRoleAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { app, actor: who } = await actor();
  const parsed = roleSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: "Choose a valid role." };
  return run("changeRole", async () => {
    await app.team.changeRole(who, parsed.data.memberId, parsed.data.role);
    revalidatePath("/", "layout");
    return { status: "success", message: "Role updated." };
  });
}

export async function removeMemberAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { app, actor: who } = await actor();
  const parsed = memberIdSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: "Unknown member." };
  return run("removeMember", async () => {
    const { unassignedTasks } = await app.team.remove(who, parsed.data.memberId);
    revalidateSettings();
    revalidatePath("/tasks");
    revalidatePath("/");
    return { status: "success", message: unassignedTasks ? `Member removed. ${unassignedTasks} open task${unassignedTasks === 1 ? " was" : "s were"} unassigned.` : "Member removed." };
  });
}

// --- Profile ---------------------------------------------------------------

/** Name (account + every member profile of the user), job title and avatar colour (this workspace). */
export async function updateProfileAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { ctx, app, actor: who } = await actor();
  const parsed = profileSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  return run("updateProfile", async () => {
    await app.team.updateProfile(who, { title: parsed.data.title, avatarColor: parsed.data.avatarColor });
    if (parsed.data.name !== ctx.user.name || parsed.data.name !== ctx.member.name) {
      await auth.api.updateUser({ body: { name: parsed.data.name }, headers: await headers() });
      await directory.renameUserMembers(ctx.user.id, parsed.data.name);
    }
    revalidatePath("/", "layout");
    return { status: "success", message: "Profile saved." };
  });
}

/** Better Auth verifies the current password; other sessions can be signed out at the same time. */
export async function changePasswordAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  await getWorkspaceApp();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
    revokeOtherSessions: formData.get("revokeOtherSessions") === "on",
  });
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };
  const { currentPassword, newPassword, revokeOtherSessions } = parsed.data;
  try {
    await auth.api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) {
      const code = String((error.body as { code?: string } | undefined)?.code ?? "");
      if (code === "INVALID_PASSWORD") return { status: "error", message: "Your current password is incorrect." };
      return { status: "error", message: error.message || "The password could not be changed." };
    }
    console.error("changePassword failed", error);
    return { status: "error", message: "The password could not be changed. Please try again." };
  }
  return { status: "success", message: revokeOtherSessions ? "Password changed. Your other sessions were signed out." : "Password changed." };
}

// --- Notifications ---------------------------------------------------------

export async function saveNotificationPreferencesAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { ctx, app } = await getWorkspaceApp();
  return run("saveNotificationPreferences", async () => {
    await app.notifications.savePreferences(ctx.member.id, preferencesFromForm(formData));
    revalidateSettings();
    return { status: "success", message: "Notification preferences saved." };
  });
}

// --- Email -----------------------------------------------------------------

function deliveryMessage(email: OutboxEmail, what: string): SettingsActionState {
  if (email.status === "sent") return { status: "success", message: `${what} delivered to ${email.to}.` };
  if (email.status === "failed") return { status: "error", message: `${what} to ${email.to} failed: ${email.error ?? "unknown error"}.` };
  return { status: "success", message: `${what} recorded in the outbox for ${email.to} (log transport: SMTP is not configured).` };
}

export async function sendTestEmailAction(): Promise<SettingsActionState> {
  const { ctx, app, actor: who } = await actor();
  return run("sendTestEmail", async () => {
    const email = await app.mail.sendTest(who, ctx.user.email);
    revalidateSettings();
    return deliveryMessage(email, "Test email");
  });
}

export async function retryEmailAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const { app, actor: who } = await actor();
  const parsed = emailIdSchema.safeParse(values(formData));
  if (!parsed.success) return { status: "error", message: "Unknown email." };
  return run("retryEmail", async () => {
    const email = await app.mail.retry(who, parsed.data.emailId);
    revalidateSettings();
    return deliveryMessage(email, "Retry");
  });
}
