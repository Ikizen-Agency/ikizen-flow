import { describe, expect, it } from "vitest";
import { defaultWorkspaceName, pickActiveMembership, slugCandidate, slugify } from "./workspace";

describe("slugify", () => {
  it("lowercases, strips accents and collapses separators", () => {
    expect(slugify("  Northstar Studio ")).toBe("northstar-studio");
    expect(slugify("Café & Co. — Labs!")).toBe("cafe-co-labs");
  });

  it("falls back to a generic slug when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("workspace");
  });

  it("numbers later candidates", () => {
    expect(slugCandidate("helix", 0)).toBe("helix");
    expect(slugCandidate("helix", 2)).toBe("helix-3");
  });
});

describe("defaultWorkspaceName", () => {
  it("uses the first name of the owner", () => {
    expect(defaultWorkspaceName("Jamie Rivera")).toBe("Jamie's Workspace");
    expect(defaultWorkspaceName("  ")).toBe("My Workspace");
  });
});

describe("pickActiveMembership", () => {
  const memberships = [{ workspace: { id: 4 } }, { workspace: { id: 9 } }];

  it("honours the requested workspace when the user belongs to it", () => {
    expect(pickActiveMembership(memberships, "9")?.workspace.id).toBe(9);
  });

  it("falls back to the first workspace for unknown, foreign or malformed ids", () => {
    expect(pickActiveMembership(memberships, "12")?.workspace.id).toBe(4);
    expect(pickActiveMembership(memberships, "abc")?.workspace.id).toBe(4);
    expect(pickActiveMembership(memberships, undefined)?.workspace.id).toBe(4);
  });

  it("returns null when the user has no workspace", () => {
    expect(pickActiveMembership([], "4")).toBeNull();
  });
});
