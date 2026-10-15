import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/connect";
import { customers, orders, user, workspaces } from "@/server/db/schema";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { LastWorkspaceError, makeDeleteWorkspace, makeProvisionWorkspace, makeUpdateWorkspace, WorkspaceSettingsError } from "../application/use-cases";
import { ForbiddenError } from "../domain/permissions";
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

describe("update workspace", () => {
  it("saves name, tagline and a normalized unique slug (owners and admins)", async () => {
    const ws = seed.workspaces.sandbox;
    const updated = await makeUpdateWorkspace(deps())({ workspaceId: ws, role: "admin" }, { name: " Helix Labs ", tagline: "R&D", slug: "Helix Labs!" });
    expect(updated).toMatchObject({ name: "Helix Labs", tagline: "R&D", slug: "helix-labs" });
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, ws));
    expect(row).toMatchObject({ name: "Helix Labs", slug: "helix-labs" });
  });

  it("rejects taken slugs, empty names and members", async () => {
    const [north] = await db.select().from(workspaces).where(eq(workspaces.id, seed.workspaces.northstar));
    const update = makeUpdateWorkspace(deps());
    await expect(update({ workspaceId: seed.workspaces.sandbox, role: "owner" }, { name: "X", tagline: "", slug: north!.slug })).rejects.toThrow(/already taken/);
    await expect(update({ workspaceId: seed.workspaces.sandbox, role: "owner" }, { name: "  ", tagline: "", slug: "x" })).rejects.toBeInstanceOf(WorkspaceSettingsError);
    await expect(update({ workspaceId: seed.workspaces.sandbox, role: "member" }, { name: "X", tagline: "", slug: "x" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("delete workspace", () => {
  it("is owner-only and needs the exact workspace name", async () => {
    const del = makeDeleteWorkspace(deps());
    const ws = seed.workspaces.sandbox;
    await expect(del({ workspaceId: ws, role: "admin", userId: seed.demoUserId }, "Helix Labs")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(del({ workspaceId: ws, role: "owner", userId: seed.demoUserId }, "helix labs")).rejects.toThrow(/Type the workspace name/);
  });

  it("deletes every row of the workspace and returns the user's next workspace", async () => {
    const ws = seed.workspaces.sandbox;
    expect((await db.select().from(orders).where(eq(orders.workspaceId, ws))).length).toBeGreaterThan(0);
    const { nextWorkspaceId } = await makeDeleteWorkspace(deps())({ workspaceId: ws, role: "owner", userId: seed.demoUserId }, "Helix Labs");
    expect(nextWorkspaceId).toBe(seed.workspaces.northstar);
    expect(await db.select().from(workspaces).where(eq(workspaces.id, ws))).toEqual([]);
    expect(await db.select().from(orders).where(eq(orders.workspaceId, ws))).toEqual([]);
    expect(await db.select().from(customers).where(eq(customers.workspaceId, ws))).toEqual([]);
    expect((await db.select().from(customers).where(eq(customers.workspaceId, seed.workspaces.northstar))).length).toBeGreaterThan(0);
  });

  it("refuses to delete the user's last workspace", async () => {
    await db.insert(user).values({ id: "u-solo", name: "Solo", email: "solo@x.test", createdAt: now, updatedAt: now });
    const { workspace } = await makeProvisionWorkspace(deps())({ userId: "u-solo", name: "Solo", email: "solo@x.test", workspaceName: "Solo Shop" });
    await expect(makeDeleteWorkspace(deps())({ workspaceId: workspace.id, role: "owner", userId: "u-solo" }, "Solo Shop")).rejects.toBeInstanceOf(LastWorkspaceError);
  });
});
