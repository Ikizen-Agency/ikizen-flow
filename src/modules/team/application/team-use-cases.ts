import type { AvatarColor } from "@/shared/domain/avatar-colors";
import type { NewOutboxEmail } from "../../mail/application/ports";
import { isSingleEmailAddress, type OutboxEmail } from "../../mail/domain/email";
import { NotFoundError, type Clock } from "../../shared-types";
import { assertCan, assignableRoles, ForbiddenError } from "../../workspaces/domain/permissions";
import type { WorkspaceRole } from "../../workspaces/domain/workspace";
import {
  acceptanceBlockedReason,
  generateInvitationToken,
  hashInvitationToken,
  invitationEmail,
  InvitationError,
  invitationExpiry,
  invitationState,
  isInvitationTokenShape,
  type Invitation,
} from "../domain/invitation";
import { JOB_TITLE_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH, type Member } from "../domain/member";
import { normalizeEmail, removalBlockedReason, roleChangeBlockedReason, TeamRuleError, type TeamActor } from "../domain/roster";
import type { InvitationDirectory, TeamRepository } from "./ports";

export interface TeamDeps {
  team: TeamRepository;
  clock: Clock;
}

function assertEmail(email: string) {
  if (!isSingleEmailAddress(email)) throw new TeamRuleError("Enter a valid email address.");
}

/** Active roster plus pending invitations. Every member can read it (assignment needs it); changes are restricted. */
export const makeListRoster =
  ({ team, clock }: TeamDeps) =>
  async () => {
    const now = clock();
    const [members, invitations] = await Promise.all([team.roster(), team.pendingInvitations(now)]);
    return { members, invitations };
  };

/** Teammate without a login (assignable to tasks, cannot sign in). Owners and admins only. */
export const makeAddTeammate =
  ({ team, clock }: TeamDeps) =>
  async (actor: TeamActor, input: { name: string; email: string; title: string }): Promise<Member> => {
    assertCan(actor.role, "members.manage");
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const title = input.title.trim();
    if (!name || name.length > MEMBER_NAME_MAX_LENGTH) throw new TeamRuleError(`Name is required (at most ${MEMBER_NAME_MAX_LENGTH} characters).`);
    if (title.length > JOB_TITLE_MAX_LENGTH) throw new TeamRuleError(`Job title must be at most ${JOB_TITLE_MAX_LENGTH} characters.`);
    assertEmail(email);
    if (await team.findEntryByEmail(email)) throw new TeamRuleError(`${email} is already on the team.`);
    return team.addTeammate({ name, email, title: title || "Teammate" }, clock());
  };

export interface InviteSender {
  workspaceName: string;
  inviterName: string;
  /** Public origin of the app, for the invite link. */
  baseUrl: string;
}

export type InviteResult = { kind: "added"; member: Member } | { kind: "invited"; invitation: Invitation; email: OutboxEmail };

/**
 * Invites someone by email. An existing user (same email) is added straight away; anyone else gets a
 * pending invitation (7 days) and an email with the invite link. Re-inviting replaces the previous link.
 */
export const makeInviteMember =
  ({ team, clock, sendEmail, generateToken = generateInvitationToken }: TeamDeps & { sendEmail: (email: NewOutboxEmail) => Promise<OutboxEmail>; generateToken?: () => string }) =>
  async (actor: TeamActor, input: { email: string; role: WorkspaceRole }, sender: InviteSender): Promise<InviteResult> => {
    assertCan(actor.role, "members.manage");
    if (!assignableRoles(actor.role).includes(input.role)) throw new ForbiddenError("Only owners can invite owners.");
    const email = normalizeEmail(input.email);
    assertEmail(email);
    const existing = await team.findEntryByEmail(email);
    if (existing?.role) throw new TeamRuleError(`${email} is already a member of this workspace.`);
    const now = clock();

    const user = await team.findUser(email);
    if (user) {
      await team.revokeInvitationsFor(email);
      const member = await team.grantAccess({ userId: user.id, name: existing?.member.name ?? user.name, email, role: input.role }, now);
      return { kind: "added", member };
    }

    await team.revokeInvitationsFor(email);
    const token = generateToken();
    const invitation = await team.createInvitation({ email, role: input.role, tokenHash: hashInvitationToken(token), invitedById: actor.memberId, expiresAt: invitationExpiry(now) }, now);
    const link = `${sender.baseUrl.replace(/\/+$/, "")}/invite/${token}`;
    const content = invitationEmail({ workspace: sender.workspaceName, inviter: sender.inviterName, role: input.role, link, expiresAt: invitation.expiresAt });
    const outbox = await sendEmail({ to: email, ...content, kind: "invite", relatedEntityType: "workspace", createdById: actor.memberId });
    return { kind: "invited", invitation, email: outbox };
  };

export const makeRevokeInvitation =
  ({ team }: Pick<TeamDeps, "team">) =>
  async (actor: TeamActor, invitationId: number) => {
    assertCan(actor.role, "members.manage");
    if (!(await team.revokeInvitation(invitationId))) throw new NotFoundError("Invitation", invitationId);
  };

async function entryOrThrow(team: TeamRepository, memberId: number) {
  const entry = await team.findEntry(memberId);
  if (!entry) throw new NotFoundError("Member", memberId);
  return entry;
}

export const makeChangeMemberRole =
  ({ team }: Pick<TeamDeps, "team">) =>
  async (actor: TeamActor, memberId: number, role: WorkspaceRole) => {
    const target = await entryOrThrow(team, memberId);
    const blocked = roleChangeBlockedReason(actor, target, role, await team.ownerCount());
    if (blocked) throw new TeamRuleError(blocked);
    if (target.role !== role) await team.setRole(memberId, role);
  };

/**
 * Removes someone from the workspace: their membership is deleted (no more access), their open tasks become
 * unassigned, and the member row is kept as removed so activity, comments, payments and completed tasks keep
 * their author.
 */
export const makeRemoveMember =
  ({ team, clock }: TeamDeps) =>
  async (actor: TeamActor, memberId: number) => {
    const target = await entryOrThrow(team, memberId);
    const blocked = removalBlockedReason(actor, target, await team.ownerCount());
    if (blocked) throw new TeamRuleError(blocked);
    return team.remove(memberId, clock());
  };

/** The actor's own job title and avatar colour in this workspace. */
export const makeUpdateMemberProfile =
  ({ team }: Pick<TeamDeps, "team">) =>
  async (actor: TeamActor, input: { title: string; avatarColor: AvatarColor | null }) => {
    const title = input.title.trim();
    if (!title || title.length > JOB_TITLE_MAX_LENGTH) throw new TeamRuleError(`Job title is required (at most ${JOB_TITLE_MAX_LENGTH} characters).`);
    await team.updateProfile(actor.memberId, { title, avatarColor: input.avatarColor });
  };

export interface InvitationUser {
  id: string;
  name: string;
  email: string;
}

async function lookup(invitations: InvitationDirectory, token: string) {
  const found = isInvitationTokenShape(token) ? await invitations.findByTokenHash(hashInvitationToken(token)) : null;
  if (!found) throw new InvitationError("not_found", "This invitation link is not valid. It may have been revoked.");
  return found;
}

/** What the invite page shows: the workspace, the state and why the signed-in user cannot accept (if so). */
export const makeGetInvitation =
  ({ invitations, clock }: { invitations: InvitationDirectory; clock: Clock }) =>
  async (token: string, user: InvitationUser | null) => {
    const now = clock();
    const { invitation, workspace } = await lookup(invitations, token);
    return {
      workspace,
      invitation,
      state: invitationState(invitation, now),
      blocked: user ? acceptanceBlockedReason(invitation, user.email, now) : null,
    };
  };

/** Joins the workspace with the invitation's role. Only the invited email, once, before it expires. */
export const makeAcceptInvitation =
  ({ invitations, clock }: { invitations: InvitationDirectory; clock: Clock }) =>
  async (token: string, user: InvitationUser) => {
    const now = clock();
    const { invitation, workspace } = await lookup(invitations, token);
    const blocked = acceptanceBlockedReason(invitation, user.email, now);
    if (blocked) throw blocked;
    if (!(await invitations.accept(invitation.id, user, now))) throw new InvitationError("accepted", "This invitation has already been used.");
    return { workspaceId: workspace.id };
  };
