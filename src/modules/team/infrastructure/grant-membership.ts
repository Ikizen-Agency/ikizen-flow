import "server-only";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, workspaceMemberships } from "@/server/db/schema";
import type { WorkspaceRole } from "../../workspaces/domain/workspace";
import type { Member } from "../domain/member";
import { memberColumns } from "./drizzle-member-repository";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Gives a user access to a workspace inside a transaction. The member row with the same email is reused
 * (a teammate without a login, or a removed member, keeps their history) and linked to the login;
 * otherwise a new member row is created. Idempotent for the membership: an existing membership keeps its
 * role (never downgraded or changed here; role changes go through the guarded `setRole`).
 */
export async function grantMembership(
  tx: Tx,
  workspaceId: number,
  { userId, name, email, role }: { userId: string; name: string; email: string; role: WorkspaceRole },
  now: Date,
): Promise<Member> {
  const [existing] = await tx
    .select(memberColumns)
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), eq(members.email, email)));
  let member: Member;
  if (existing) {
    await tx.update(members).set({ userId, removedAt: null }).where(eq(members.id, existing.id));
    member = { ...existing, userId };
  } else {
    const [created] = await tx.insert(members).values({ workspaceId, userId, name, email, role: "Teammate", createdAt: now }).returning(memberColumns);
    member = created!;
  }
  await tx
    .insert(workspaceMemberships)
    .values({ workspaceId, userId, memberId: member.id, role, createdAt: now })
    .onConflictDoUpdate({ target: [workspaceMemberships.workspaceId, workspaceMemberships.userId], set: { memberId: member.id } });
  return member;
}
