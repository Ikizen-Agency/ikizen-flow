import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeSendEmail } from "@/modules/mail/application/use-cases";
import { DrizzleEmailOutbox } from "@/modules/mail/infrastructure/drizzle-email-outbox";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task-repository";
import { ForbiddenError } from "@/modules/workspaces/domain/permissions";
import { DrizzleWorkspaceDirectory } from "@/modules/workspaces/infrastructure/drizzle-workspace-directory";
import type { Database } from "@/server/db/connect";
import { members as membersTable, tasks, user } from "@/server/db/schema";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import {
  makeAcceptInvitation,
  makeAddTeammate,
  makeChangeMemberRole,
  makeGetInvitation,
  makeInviteMember,
  makeListRoster,
  makeRemoveMember,
  makeRevokeInvitation,
  makeUpdateMemberProfile,
} from "../application/team-use-cases";
import { InvitationError } from "../domain/invitation";
import { TeamRuleError } from "../domain/roster";
import { DrizzleInvitationDirectory } from "./drizzle-invitation-directory";
import { DrizzleMemberRepository } from "./drizzle-member-repository";
import { DrizzleTeamRepository } from "./drizzle-team-repository";

let now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;
let ws: number;
let alex: number;
const sent: string[] = [];
let nextToken = "A".repeat(43);

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
  ws = seed.workspaces.northstar;
  alex = seed.demoMembers.northstar;
});
afterAll(() => cleanup());

function deps(workspaceId = ws) {
  const outbox = new DrizzleEmailOutbox(db, workspaceId);
  const mailer = { transport: "log" as const, deliver: async (m: { to: string }) => (sent.push(m.to), { status: "logged" as const }) };
  return {
    team: new DrizzleTeamRepository(db, workspaceId),
    invitations: new DrizzleInvitationDirectory(db),
    clock: () => now,
    sendEmail: makeSendEmail({ outbox, mailer, clock: () => now }),
    generateToken: () => nextToken,
    outbox,
  };
}
const owner = () => ({ memberId: alex, role: "owner" as const });
const sender = { workspaceName: "Northstar Studio", inviterName: "Alex Vance", baseUrl: "http://localhost:3000/" };

async function createUser(id: string, name: string, email: string) {
  await db.insert(user).values({ id, name, email, createdAt: now, updatedAt: now });
  return { id, name, email };
}

describe("roster", () => {
  it("lists members with their access level (null for teammates without a login)", async () => {
    const { members } = await makeListRoster(deps())();
    expect(members.find((m) => m.member.id === alex)).toMatchObject({ role: "owner", member: { email: "alex@northstar.studio" } });
    expect(members.find((m) => m.member.name === "Maya Chen")).toMatchObject({ role: null, member: { userId: null } });
  });

  it("adds a teammate without a login, refusing duplicates and members", async () => {
    const added = await makeAddTeammate(deps())(owner(), { name: "Noah Park", email: " Noah@Northstar.studio ", title: "Copywriter" });
    expect(added).toMatchObject({ name: "Noah Park", email: "noah@northstar.studio", role: "Copywriter", userId: null });
    await expect(makeAddTeammate(deps())(owner(), { name: "Noah", email: "noah@northstar.studio", title: "" })).rejects.toBeInstanceOf(TeamRuleError);
    await expect(makeAddTeammate(deps())({ memberId: alex, role: "member" }, { name: "X", email: "x@x.test", title: "" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("invitations", () => {
  it("adds an existing user directly to the workspace", async () => {
    await createUser("u-maya", "Maya Chen", "maya@northstar.studio");
    const result = await makeInviteMember(deps())(owner(), { email: "MAYA@northstar.studio", role: "admin" }, sender);
    expect(result.kind).toBe("added");
    const { members } = await makeListRoster(deps())();
    // The existing teammate row (same email) is linked to the login instead of duplicated.
    expect(members.filter((m) => m.member.email === "maya@northstar.studio")).toEqual([
      expect.objectContaining({ role: "admin", member: expect.objectContaining({ name: "Maya Chen", userId: "u-maya" }) }),
    ]);
    await expect(makeInviteMember(deps())(owner(), { email: "maya@northstar.studio", role: "member" }, sender)).rejects.toThrow(/already a member/);
  });

  it("creates a pending invitation and emails the invite link to unknown addresses", async () => {
    nextToken = "B".repeat(43);
    const result = await makeInviteMember(deps())(owner(), { email: "jo@agency.test", role: "member" }, sender);
    expect(result.kind).toBe("invited");
    if (result.kind !== "invited") return;
    expect(result.email).toMatchObject({ kind: "invite", to: "jo@agency.test", status: "logged" });
    expect(result.email.text).toContain(`http://localhost:3000/invite/${"B".repeat(43)}`);
    const { invitations } = await makeListRoster(deps())();
    expect(invitations.map((i) => i.email)).toContain("jo@agency.test");
  });

  it("refuses invitations from members and owner invitations from admins", async () => {
    await expect(makeInviteMember(deps())({ memberId: alex, role: "member" }, { email: "a@b.test", role: "member" }, sender)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(makeInviteMember(deps())({ memberId: alex, role: "admin" }, { email: "a@b.test", role: "owner" }, sender)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets only the invited email accept, once, before it expires", async () => {
    const token = "B".repeat(43);
    const intruder = await createUser("u-intruder", "Eve", "eve@evil.test");
    await expect(makeAcceptInvitation(deps())(token, intruder)).rejects.toMatchObject({ reason: "email_mismatch" });

    const jo = await createUser("u-jo", "Jo Lee", "jo@agency.test");
    const view = await makeGetInvitation(deps())(token, jo);
    expect(view).toMatchObject({ workspace: { name: "Northstar Studio" }, state: "pending", blocked: null });

    const { workspaceId } = await makeAcceptInvitation(deps())(token, jo);
    expect(workspaceId).toBe(ws);
    const mine = await new DrizzleWorkspaceDirectory(db).listForUser("u-jo");
    expect(mine.map((m) => [m.workspace.id, m.role])).toContainEqual([ws, "member"]);
    await expect(makeAcceptInvitation(deps())(token, jo)).rejects.toMatchObject({ reason: "accepted" });
  });

  it("rejects expired and unknown tokens", async () => {
    nextToken = "C".repeat(43);
    await makeInviteMember(deps())(owner(), { email: "late@agency.test", role: "member" }, sender);
    const late = await createUser("u-late", "Late", "late@agency.test");
    const saved = now;
    now = new Date(now.getTime() + 8 * 24 * 3600 * 1000);
    await expect(makeAcceptInvitation(deps())("C".repeat(43), late)).rejects.toMatchObject({ reason: "expired" });
    now = saved;
    await expect(makeAcceptInvitation(deps())("Z".repeat(43), late)).rejects.toBeInstanceOf(InvitationError);
    await expect(makeAcceptInvitation(deps())("short", late)).rejects.toMatchObject({ reason: "not_found" });
  });

  it("revokes pending invitations (managers only)", async () => {
    const { invitations } = await makeListRoster(deps())();
    const target = invitations.find((i) => i.email === "late@agency.test")!;
    await expect(makeRevokeInvitation(deps())({ memberId: alex, role: "member" }, target.id)).rejects.toBeInstanceOf(ForbiddenError);
    await makeRevokeInvitation(deps())(owner(), target.id);
    expect((await makeListRoster(deps())()).invitations.map((i) => i.id)).not.toContain(target.id);
  });
});

describe("roles and removal", () => {
  const entryOf = async (email: string) => (await makeListRoster(deps())()).members.find((m) => m.member.email === email)!;

  it("changes roles and never demotes the last owner", async () => {
    const maya = await entryOf("maya@northstar.studio");
    await makeChangeMemberRole(deps())(owner(), maya.member.id, "member");
    expect((await entryOf("maya@northstar.studio")).role).toBe("member");
    await expect(makeChangeMemberRole(deps())(owner(), alex, "admin")).rejects.toThrow(/at least one owner/);
    await expect(makeChangeMemberRole(deps())({ memberId: maya.member.id, role: "member" }, alex, "member")).rejects.toBeInstanceOf(TeamRuleError);
  });

  it("removes a member: access revoked, open tasks unassigned, history kept, hidden from pickers", async () => {
    const jo = await entryOf("jo@agency.test");
    const taskRepo = new DrizzleTaskRepository(db, ws);
    const [open, done] = await db.select({ id: tasks.id, status: tasks.status }).from(tasks).where(eq(tasks.workspaceId, ws)).limit(2);
    await db.update(tasks).set({ assigneeId: jo.member.id, status: "todo" }).where(eq(tasks.id, open!.id));
    await db.update(tasks).set({ assigneeId: jo.member.id, status: "completed" }).where(eq(tasks.id, done!.id));

    const { unassignedTasks } = await makeRemoveMember(deps())(owner(), jo.member.id);
    expect(unassignedTasks).toBe(1);
    expect((await taskRepo.findById(open!.id))!.assigneeId).toBeNull();
    expect((await taskRepo.findById(done!.id))!.assigneeId).toBe(jo.member.id);
    expect(await new DrizzleWorkspaceDirectory(db).listForUser("u-jo")).toEqual([]);
    expect((await new DrizzleMemberRepository(db, ws).list()).map((m) => m.email)).not.toContain("jo@agency.test");
    expect((await makeListRoster(deps())()).members.map((m) => m.member.email)).not.toContain("jo@agency.test");
  });

  it("refuses removing yourself or the last owner", async () => {
    await expect(makeRemoveMember(deps())(owner(), alex)).rejects.toThrow(/cannot remove yourself/);
    const maya = await entryOf("maya@northstar.studio");
    await makeChangeMemberRole(deps())(owner(), maya.member.id, "admin");
    await expect(makeRemoveMember(deps())({ memberId: maya.member.id, role: "admin" }, alex)).rejects.toThrow(/Only owners can remove an owner/);
  });

  it("re-adding a removed teammate restores the same member row", async () => {
    const [before] = await db.select().from(membersTable).where(eq(membersTable.email, "jo@agency.test"));
    const restored = await makeAddTeammate(deps())(owner(), { name: "Jo Lee", email: "jo@agency.test", title: "Designer" });
    expect(restored.id).toBe(before!.id);
  });

  it("updates the actor's own job title and avatar colour", async () => {
    await makeUpdateMemberProfile(deps())(owner(), { title: "Studio Director", avatarColor: "success" });
    expect(await entryOf("alex@northstar.studio")).toMatchObject({ member: { role: "Studio Director", avatarColor: "success" } });
  });
});

describe("owner guard and stale invitations", () => {
  const entryOf = async (email: string) => (await makeListRoster(deps())()).members.find((m) => m.member.email === email)!;
  const ownerIds = async () => (await makeListRoster(deps())()).members.filter((m) => m.role === "owner").map((m) => m.member.id);
  /** A team repository whose owner count is read before a concurrent change landed. */
  const staleCount = () => {
    const { team } = deps();
    return { team: Object.assign(Object.create(team) as typeof team, { ownerCount: async () => 2 }), clock: () => now };
  };

  it("never leaves zero owners when two owners demote each other", async () => {
    const maya = await entryOf("maya@northstar.studio");
    await makeChangeMemberRole(deps())(owner(), maya.member.id, "owner");
    const results = await Promise.allSettled([
      makeChangeMemberRole(deps())(owner(), maya.member.id, "member"),
      makeChangeMemberRole(deps())({ memberId: maya.member.id, role: "owner" }, alex, "member"),
    ]);
    expect(results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason))).toEqual([expect.stringMatching(/at least one owner/)]);
    expect(await ownerIds()).toHaveLength(1);
  });

  it("re-checks the owner count atomically when demoting or removing the last owner", async () => {
    const [last] = await ownerIds();
    await expect(makeChangeMemberRole(staleCount())({ memberId: -1, role: "owner" }, last!, "member")).rejects.toThrow(/at least one owner/);
    await expect(makeRemoveMember(staleCount())({ memberId: -1, role: "owner" }, last!)).rejects.toThrow(/at least one owner/);
    expect(await ownerIds()).toEqual([last]);
  });

  it("refuses a stale invitation for someone who is already a member and keeps their role", async () => {
    nextToken = "D".repeat(43);
    await makeInviteMember(deps())(owner(), { email: "kim@agency.test", role: "member" }, sender);
    const kim = await createUser("u-kim", "Kim Ito", "kim@agency.test");
    await deps().team.grantAccess({ userId: kim.id, name: kim.name, email: kim.email, role: "owner" }, now);

    await expect(makeAcceptInvitation(deps())("D".repeat(43), kim)).rejects.toMatchObject({ reason: "already_member" });
    expect((await entryOf("kim@agency.test")).role).toBe("owner");
  });

  it("never changes an existing membership's role when access is granted again", async () => {
    const kim = { id: "u-kim", name: "Kim Ito", email: "kim@agency.test" };
    await deps().team.grantAccess({ userId: kim.id, name: kim.name, email: kim.email, role: "member" }, now);
    expect((await entryOf("kim@agency.test")).role).toBe("owner");
  });
});
