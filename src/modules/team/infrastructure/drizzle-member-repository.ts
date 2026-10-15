import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members } from "@/server/db/schema";
import type { MemberRepository } from "../application/ports";

const columns = { id: members.id, name: members.name, email: members.email, role: members.role, userId: members.userId };

export class DrizzleMemberRepository implements MemberRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  list() {
    return this.db.select(columns).from(members).where(eq(members.workspaceId, this.workspaceId)).orderBy(asc(members.name));
  }

  async findById(id: number) {
    const [row] = await this.db
      .select(columns)
      .from(members)
      .where(and(eq(members.id, id), eq(members.workspaceId, this.workspaceId)));
    return row ?? null;
  }
}
