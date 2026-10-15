import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import type { NewOutboxEmail } from "@/modules/mail/application/ports";
import type { OutboxEmail } from "@/modules/mail/domain/email";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { NotFoundError } from "../../shared-types";
import { CustomerHasDependenciesError } from "../domain/customer";
import { DrizzleCustomerRepository } from "../infrastructure/drizzle-customer-repository";
import {
  DuplicateCustomerError,
  makeApplyCustomerTier,
  makeArchiveCustomers,
  makeCreateCustomer,
  makeDeleteCustomer,
  makeDeleteCustomers,
  makeSendCampaign,
  makeUpdateCustomer,
} from "./use-cases";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let ws: number;
let sandboxWs: number;
let actor: number;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  const seeded = await seedDatabase(db, now);
  ws = seeded.workspaces.northstar;
  sandboxWs = seeded.workspaces.sandbox;
  actor = seeded.demoMembers.northstar;
});
afterAll(() => cleanup());

const deps = (workspaceId = ws) => ({
  customers: new DrizzleCustomerRepository(db, workspaceId),
  activity: new DrizzleActivityRepository(db, workspaceId),
  clock: () => now,
});

async function idOf(company: string, workspaceId = ws) {
  const found = await deps(workspaceId).customers.findByCompany(company);
  if (!found) throw new Error(`missing ${company}`);
  return found.id;
}

async function createBlank(company: string) {
  const customer = await makeCreateCustomer(deps())({
    company,
    tier: "project",
    status: "active",
    industry: "Retail",
    contactName: "Test Contact",
    contactEmail: `${company.toLowerCase().replace(/\W+/g, "")}@example.com`,
  });
  return customer.id;
}

describe("updateCustomer", () => {
  it("updates every editable field and records an activity event", async () => {
    const id = await createBlank("Editable Co");
    const updated = await makeUpdateCustomer(deps())(
      id,
      {
        company: "Editable Company",
        tier: "enterprise",
        status: "pending_review",
        industry: "Logistics",
        contactName: "Maya Chen",
        contactEmail: "maya@editable.io",
        billingEmail: "ap@editable.io",
        paymentTerms: "net_15",
      },
      actor,
    );
    expect(updated).toMatchObject({ company: "Editable Company", tier: "enterprise", status: "pending_review", paymentTerms: "net_15", billingEmail: "ap@editable.io" });
    const events = await deps().activity.forEntity("customer", id, 5);
    expect(events[0]?.message).toMatch(/Editable Company/);
  });

  it("rejects renaming to another customer's name but allows keeping its own name", async () => {
    const id = await createBlank("Rename Target");
    await expect(makeUpdateCustomer(deps())(id, { company: "apex digital labs" }, actor)).rejects.toBeInstanceOf(DuplicateCustomerError);
    await expect(makeUpdateCustomer(deps())(id, { company: "RENAME TARGET", tier: "retainer" }, actor)).resolves.toMatchObject({ tier: "retainer" });
  });

  it("cannot reach a customer of another workspace", async () => {
    const foreign = await idOf("Quanta Bioworks", sandboxWs);
    await expect(makeUpdateCustomer(deps())(foreign, { tier: "enterprise" }, actor)).rejects.toBeInstanceOf(NotFoundError);
    expect((await deps(sandboxWs).customers.findById(foreign))?.tier).not.toBe("enterprise");
  });
});

describe("archiving", () => {
  it("hides archived customers by default and lists them under the archived filter", async () => {
    const id = await createBlank("Archive Me Ltd");
    const changed = await makeArchiveCustomers(deps())([id], true, actor);
    expect(changed.map((c) => c.id)).toEqual([id]);

    const { customers } = deps();
    expect((await customers.list({ search: "Archive Me" })).items).toHaveLength(0);
    const archived = (await customers.list({ search: "Archive Me", status: "archived" })).items;
    expect(archived.map((c) => c.id)).toEqual([id]);
    expect(archived[0]!.status).toBe("archived");
    expect(archived[0]!.archivedAt).toEqual(now);
    expect((await customers.countByStatus()).archived).toBeGreaterThanOrEqual(1);

    await makeArchiveCustomers(deps())([id], false, actor);
    const restored = await customers.findById(id);
    expect(restored).toMatchObject({ status: "active", archivedAt: null });
  });

  it("ignores ids from another workspace in bulk archive", async () => {
    const foreign = await idOf("Quanta Bioworks", sandboxWs);
    const own = await createBlank("Bulk Archive Own");
    const changed = await makeArchiveCustomers(deps())([own, foreign], true, actor);
    expect(changed.map((c) => c.id)).toEqual([own]);
    expect((await deps(sandboxWs).customers.findById(foreign))?.archivedAt).toBeNull();
  });
});

describe("applyCustomerTier", () => {
  it("retags only customers of the workspace", async () => {
    const a = await createBlank("Tier One");
    const b = await createBlank("Tier Two");
    const foreign = await idOf("Quanta Bioworks", sandboxWs);
    const foreignTier = (await deps(sandboxWs).customers.findById(foreign))!.tier;
    const changed = await makeApplyCustomerTier(deps())([a, b, foreign], "retainer", actor);
    expect(changed.map((c) => c.id).sort()).toEqual([a, b].sort());
    expect((await deps().customers.findById(a))?.tier).toBe("retainer");
    expect((await deps(sandboxWs).customers.findById(foreign))?.tier).toBe(foreignTier);
  });
});

describe("deleting", () => {
  it("hard-deletes a customer without orders or tasks", async () => {
    const id = await createBlank("Delete Me Inc");
    await makeDeleteCustomer(deps())(id, actor);
    expect(await deps().customers.findById(id)).toBeNull();
  });

  it("refuses to delete a customer with orders", async () => {
    const apex = await idOf("Apex Digital Labs");
    await expect(makeDeleteCustomer(deps())(apex, actor)).rejects.toBeInstanceOf(CustomerHasDependenciesError);
    expect(await deps().customers.findById(apex)).not.toBeNull();
  });

  it("bulk delete skips customers with history and ignores other workspaces", async () => {
    const free = await createBlank("Bulk Delete Free");
    const apex = await idOf("Apex Digital Labs");
    const foreign = await idOf("Quanta Bioworks", sandboxWs);
    const result = await makeDeleteCustomers(deps())([free, apex, foreign], actor);
    expect(result.deleted.map((c) => c.id)).toEqual([free]);
    expect(result.skipped.map((s) => s.customer.id)).toEqual([apex]);
    expect(result.skipped[0]!.orders).toBeGreaterThan(0);
    expect(await deps(sandboxWs).customers.findById(foreign)).not.toBeNull();
  });
});

describe("sendCampaign", () => {
  it("sends one campaign email per selected customer of the workspace and summarises the outcome", async () => {
    const sent: NewOutboxEmail[] = [];
    let n = 0;
    const sendEmail = async (email: NewOutboxEmail): Promise<OutboxEmail> => {
      sent.push(email);
      n += 1;
      const status = n === 2 ? "failed" : "logged";
      return { ...email, id: n, html: null, status, error: status === "failed" ? "boom" : null, relatedEntityType: email.relatedEntityType ?? null, relatedEntityId: email.relatedEntityId ?? null, createdById: email.createdById ?? null, createdAt: now, sentAt: null };
    };
    const apex = await idOf("Apex Digital Labs");
    const solas = await createBlank("Campaign Target");
    const foreign = await idOf("Quanta Bioworks", sandboxWs);

    const summary = await makeSendCampaign({ ...deps(), sendEmail })({ ids: [apex, solas, foreign], subject: "Q4 offer", message: "Hello there." }, actor);

    expect(summary).toEqual({ total: 2, sent: 0, logged: 1, failed: 1 });
    expect(sent).toHaveLength(2);
    expect(sent.every((e) => e.kind === "campaign" && e.subject === "Q4 offer" && e.relatedEntityType === "customer" && e.createdById === actor)).toBe(true);
    expect(sent.map((e) => e.to)).toContain("campaigntarget@example.com");
  });
});
