import type { Member } from "../domain/member";

export interface MemberRepository {
  list(): Promise<Member[]>;
  findByName(name: string): Promise<Member | null>;
}
