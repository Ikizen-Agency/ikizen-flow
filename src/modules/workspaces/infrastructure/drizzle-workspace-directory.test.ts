import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/connect";
import { user } from "@/server/db/schema";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { makeListMyWorkspaces, makeProvisionWorkspace } from "../application/use-cases";
import { DrizzleWorkspaceDirectory } from "./drizzle-workspace-directory";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now);
});
afterAll(() => cleanup());

const deps = () => ({ workspaces: new DrizzleWorkspaceDirectory(db), clock: () => now });

async function createUser(id: string, name: string, email: string) {
  await db.insert(user).values({ id, name, email, createdAt: now, updatedAt: now });
}

describe("workspace directory", () => {
  it("lists the demo user's workspaces with the owner role and member profile", async () => {
    const mine = await makeListMyWorkspaces(deps())(seed.demoUserId);
    expect(mine.map((m) => m.workspace.name)).toEqual(["Northstar Studio", "Helix Labs Sandbox"]);
    expect(mine[0]).toMatchObject({ role: "owner", member: { name: "Alex Vance", email: "alex@northstar.studio" } });
    expect(mine[0]!.workspace.tagline).toBe("Digital Operations");
  });

  it("returns nothing for a user without memberships", async () => {
    expect(await makeListMyWorkspaces(deps())("nobody")).toEqual([]);
  });
});

describe("registration provisioning", () => {
  it("creates a new workspace owned by the registering user, with a unique slug", async () => {
    await createUser("u-jamie", "Jamie Rivera", "jamie@helix.dev");
    const provision = makeProvisionWorkspace(deps());
    const created = await provision({ userId: "u-jamie", name: "Jamie Rivera", email: "jamie@helix.dev", workspaceName: "Northstar Studio" });

    expect(created.workspace.name).toBe("Northstar Studio");
    expect(created.workspace.slug).toBe("northstar-studio-2");
    expect(created.role).toBe("owner");
    expect(created.member).toMatchObject({ name: "Jamie Rivera", email: "jamie@helix.dev", role: "Owner" });

    const mine = await makeListMyWorkspaces(deps())("u-jamie");
    expect(mine.map((m) => m.workspace.id)).toEqual([created.workspace.id]);
    expect(mine[0]!.workspace.id).not.toBe(seed.workspaces.northstar);
  });

  it("names the workspace after the owner when no name is given", async () => {
    await createUser("u-sam", "Sam Okoro", "sam@example.com");
    const created = await makeProvisionWorkspace(deps())({ userId: "u-sam", name: "Sam Okoro", email: "sam@example.com" });
    expect(created.workspace.name).toBe("Sam's Workspace");
    expect(created.workspace.slug).toBe("sam-s-workspace");
  });
});
