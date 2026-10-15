import "server-only";
import { asc, eq } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members } from "@/server/db/schema";
import type { MemberRepository } from "../application/ports";

const columns = { id: members.id, name: members.name, email: members.email, role: members.role };

export class DrizzleMemberRepository implements MemberRepository {
  constructor(private readonly db: Database) {}

  list() {
    return this.db.select(columns).from(members).orderBy(asc(members.name));
  }

  async findByName(name: string) {
    const [row] = await this.db.select(columns).from(members).where(eq(members.name, name));
    return row ?? null;
  }
}
