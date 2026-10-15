import { describe, expect, it } from "vitest";
import { assignableRoles, assertCan, can, ForbiddenError } from "../../workspaces/domain/permissions";
import { removalBlockedReason, roleChangeBlockedReason, type RosterEntry } from "./roster";

const entry = (id: number, role: RosterEntry["role"]): RosterEntry => ({
  member: { id, name: `M${id}`, email: `m${id}@x.test`, role: "Title", userId: role ? `u${id}` : null },
  role,
  createdAt: new Date(0),
});
const owner = { memberId: 1, role: "owner" as const };
const admin = { memberId: 2, role: "admin" as const };
const member = { memberId: 3, role: "member" as const };

describe("workspace permissions", () => {
  it("lets owners do everything, admins everything but deleting, members nothing", () => {
    expect(can("owner", "workspace.delete")).toBe(true);
    expect(can("admin", "workspace.delete")).toBe(false);
    expect(can("admin", "members.manage")).toBe(true);
    expect(can("member", "workspace.update")).toBe(false);
    expect(() => assertCan("member", "mail.manage")).toThrow(ForbiddenError);
  });

  it("limits the roles an actor can grant", () => {
    expect(assignableRoles("owner")).toEqual(["owner", "admin", "member"]);
    expect(assignableRoles("admin")).toEqual(["admin", "member"]);
    expect(assignableRoles("member")).toEqual([]);
  });
});

describe("roleChangeBlockedReason", () => {
  it("allows owners to promote and demote when another owner remains", () => {
    expect(roleChangeBlockedReason(owner, entry(5, "member"), "owner", 1)).toBeNull();
    expect(roleChangeBlockedReason(owner, entry(5, "owner"), "admin", 2)).toBeNull();
  });

  it("never demotes the last owner", () => {
    expect(roleChangeBlockedReason(owner, entry(1, "owner"), "member", 1)).toMatch(/at least one owner/);
  });

  it("keeps ownership changes for owners", () => {
    expect(roleChangeBlockedReason(admin, entry(5, "member"), "owner", 2)).toMatch(/Only owners can make/);
    expect(roleChangeBlockedReason(admin, entry(1, "owner"), "member", 2)).toMatch(/Only owners can change an owner/);
    expect(roleChangeBlockedReason(admin, entry(5, "member"), "admin", 1)).toBeNull();
  });

  it("refuses members and teammates without a login", () => {
    expect(roleChangeBlockedReason(member, entry(5, "member"), "admin", 1)).toMatch(/Only owners and admins/);
    expect(roleChangeBlockedReason(owner, entry(6, null), "admin", 1)).toMatch(/without a login/);
  });
});

describe("removalBlockedReason", () => {
  it("lets managers remove members and teammates", () => {
    expect(removalBlockedReason(admin, entry(5, "member"), 1)).toBeNull();
    expect(removalBlockedReason(admin, entry(6, null), 1)).toBeNull();
    expect(removalBlockedReason(owner, entry(7, "owner"), 2)).toBeNull();
  });

  it("protects owners, the last owner and the actor", () => {
    expect(removalBlockedReason(admin, entry(7, "owner"), 2)).toMatch(/Only owners can remove an owner/);
    expect(removalBlockedReason({ memberId: 9, role: "owner" }, entry(7, "owner"), 1)).toMatch(/at least one owner/);
    expect(removalBlockedReason(owner, entry(1, "owner"), 2)).toMatch(/cannot remove yourself/);
    expect(removalBlockedReason(member, entry(5, "member"), 1)).toMatch(/Only owners and admins/);
  });
});
