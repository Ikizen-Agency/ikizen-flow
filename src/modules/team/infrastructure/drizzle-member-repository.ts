import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members } from "@/server/db/schema";
import type { MemberRepository } from "../application/ports";

export const memberColumns = {
  id: members.id,
  name: members.name,
  email: members.email,
  role: members.role,
  userId: members.userId,
  avatarColor: members.avatarColor,
};

/** Active members of one workspace (removed members stay in the table for history only). */
export class DrizzleMemberRepository implements MemberRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  list() {
    return this.db
      .select(memberColumns)
      .from(members)
      .where(and(eq(members.workspaceId, this.workspaceId), isNull(members.removedAt)))
      .orderBy(asc(members.name));
  }

  async findById(id: number) {
    const [row] = await this.db
      .select(memberColumns)
      .from(members)
      .where(and(eq(members.id, id), eq(members.workspaceId, this.workspaceId), isNull(members.removedAt)));
    return row ?? null;
  }
}
