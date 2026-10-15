import { z } from "zod";
import { AVATAR_COLORS } from "@/shared/domain/avatar-colors";
import { isSingleEmailAddress } from "../../mail/domain/email";
import { NOTIFICATION_TYPES } from "../../notifications/domain/notification";
import type { NotificationPreference } from "../../notifications/domain/preferences";
import { JOB_TITLE_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "../../team/domain/member";
import { WORKSPACE_NAME_MAX_LENGTH, WORKSPACE_TAGLINE_MAX_LENGTH } from "../../workspaces/application/use-cases";
import { WORKSPACE_ROLES } from "../../workspaces/domain/workspace";

/** Result of every settings Server Action (rendered inline next to the form). */
export interface SettingsActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const IDLE: SettingsActionState = { status: "idle" };

const email = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isSingleEmailAddress, "Enter a valid email address.");

export const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required.").max(WORKSPACE_NAME_MAX_LENGTH),
  tagline: z.string().trim().max(WORKSPACE_TAGLINE_MAX_LENGTH, `Use at most ${WORKSPACE_TAGLINE_MAX_LENGTH} characters.`),
  slug: z.string().trim().max(60),
});

export const deleteWorkspaceSchema = z.object({ confirmName: z.string() });

export const teammateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(MEMBER_NAME_MAX_LENGTH),
  email,
  title: z.string().trim().max(JOB_TITLE_MAX_LENGTH),
});

export const inviteSchema = z.object({ email, role: z.enum(WORKSPACE_ROLES) });

export const memberIdSchema = z.object({ memberId: z.coerce.number().int().positive() });
export const roleSchema = memberIdSchema.extend({ role: z.enum(WORKSPACE_ROLES) });
export const invitationIdSchema = z.object({ invitationId: z.coerce.number().int().positive() });
export const emailIdSchema = z.object({ emailId: z.coerce.number().int().positive() });

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(MEMBER_NAME_MAX_LENGTH),
  title: z.string().trim().min(1, "Job title is required.").max(JOB_TITLE_MAX_LENGTH),
  avatarColor: z
    .union([z.literal(""), z.enum(AVATAR_COLORS)])
    .transform((v) => (v === "" ? null : v)),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters."),
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "The new passwords do not match." });
    else if (value.newPassword === value.currentPassword) ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password different from the current one." });
  });

/** Checkbox grid of the Notifications tab: `inApp:<type>` / `email:<type>`; unchecked boxes are absent. */
export function preferencesFromForm(form: FormData): NotificationPreference[] {
  return NOTIFICATION_TYPES.map((type) => ({ type, inApp: form.get(`inApp:${type}`) === "on", email: form.get(`email:${type}`) === "on" }));
}

/** First validation message of a failed parse. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form.";
}
