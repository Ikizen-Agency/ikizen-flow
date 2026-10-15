import type { Member } from "../domain/member";

/** Members of one workspace (the adapter is constructed for a workspace). */
export interface MemberRepository {
  list(): Promise<Member[]>;
  findById(id: number): Promise<Member | null>;
}
