import { createHash, randomBytes } from "node:crypto";
import { formatDate } from "@/shared/domain/time";
import { WORKSPACE_ROLE_LABELS, type WorkspaceRole } from "../../workspaces/domain/workspace";

export const INVITATION_TTL_DAYS = 7;

/** A pending (or used / expired) invitation to join a workspace. Only the token hash is stored. */
export interface Invitation {
  id: number;
  email: string;
  role: WorkspaceRole;
  invitedById: number | null;
  invitedByName: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export type InvitationState = "pending" | "accepted" | "expired";

export function invitationState(invitation: Pick<Invitation, "expiresAt" | "acceptedAt">, now: Date): InvitationState {
  if (invitation.acceptedAt) return "accepted";
  return invitation.expiresAt.getTime() <= now.getTime() ? "expired" : "pending";
}

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Random URL-safe secret for the invite link (256 bits). */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored hashed, so a database leak does not leak usable invite links. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Shape check before any lookup (base64url, 43 characters for 32 bytes). */
export function isInvitationTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export class InvitationError extends Error {
  constructor(
    readonly reason: "not_found" | "expired" | "accepted" | "email_mismatch" | "already_member",
    message: string,
  ) {
    super(message);
    this.name = "InvitationError";
  }
}

/** Why the signed-in user cannot accept this invitation (null when they can). */
export function acceptanceBlockedReason(invitation: Pick<Invitation, "email" | "expiresAt" | "acceptedAt">, userEmail: string, now: Date): InvitationError | null {
  const state = invitationState(invitation, now);
  if (state === "accepted") return new InvitationError("accepted", "This invitation has already been used.");
  if (state === "expired") return new InvitationError("expired", "This invitation has expired. Ask for a new one.");
  if (invitation.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
    return new InvitationError("email_mismatch", `This invitation was sent to ${invitation.email}. Sign in with that email address to accept it.`);
  }
  return null;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
const oneLine = (text: string) => text.replace(/[\r\n]+/g, " ").trim();

export function invitationEmail(input: { workspace: string; inviter: string; role: WorkspaceRole; link: string; expiresAt: Date }) {
  const role = WORKSPACE_ROLE_LABELS[input.role].toLowerCase();
  const subject = oneLine(`${input.inviter} invited you to ${input.workspace} on Ikizen Flow`);
  const text = [
    "Hello,",
    "",
    `${input.inviter} invited you to join ${input.workspace} on Ikizen Flow as ${role === "admin" ? "an" : "a"} ${role}.`,
    "",
    `Accept the invitation: ${input.link}`,
    "",
    `The link expires on ${formatDate(input.expiresAt)}. Sign in (or create an account) with this email address to accept it.`,
  ].join("\n");
  const html = [
    "<p>Hello,</p>",
    `<p>${escapeHtml(input.inviter)} invited you to join <strong>${escapeHtml(input.workspace)}</strong> on Ikizen Flow as ${role === "admin" ? "an" : "a"} ${escapeHtml(role)}.</p>`,
    `<p><a href="${escapeHtml(input.link)}">Accept the invitation</a></p>`,
    `<p>The link expires on ${escapeHtml(formatDate(input.expiresAt))}. Sign in (or create an account) with this email address to accept it.</p>`,
  ].join("");
  return { subject, text, html };
}
