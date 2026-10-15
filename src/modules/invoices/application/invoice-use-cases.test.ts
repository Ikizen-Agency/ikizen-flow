import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { DrizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import type { Mailer } from "@/modules/mail/application/ports";
import { makeSendEmail } from "@/modules/mail/application/use-cases";
import { DrizzleEmailOutbox } from "@/modules/mail/infrastructure/drizzle-email-outbox";
import { makeChangeOrderStatus, makeCreateOrder } from "@/modules/sales/application/use-cases";
import { DrizzleOrderRepository } from "@/modules/sales/infrastructure/drizzle-order-repository";
import { DrizzlePaymentRepository } from "@/modules/sales/infrastructure/drizzle-payment-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import { NotFoundError } from "../../shared-types";
import { InvoiceActionError } from "../domain/invoice";
import { DrizzleInvoiceRepository } from "../infrastructure/drizzle-invoice-repository";
import {
  makeGetInvoice,
  makeGetInvoiceOverview,
  makeListInvoiceableOrders,
  makeListInvoices,
  makeSendInvoice,
  makeSendInvoiceReminder,
} from "./use-cases";

const now = new Date("2026-10-14T12:00:00Z");
let db: Database;
let cleanup: () => void;
let ws: number;
let sandboxWs: number;
let actor: number;
const delivered: Array<{ to: string; subject: string; text: string }> = [];
let failDelivery = false;

const fakeMailer: Mailer = {
  transport: "log",
  async deliver(message) {
    if (failDelivery) throw new Error("SMTP down");
    delivered.push({ to: message.to, subject: message.subject, text: message.text });
    return { status: "logged" };
  },
};

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  const seeded = await seedDatabase(db, now);
  ws = seeded.workspaces.northstar;
  sandboxWs = seeded.workspaces.sandbox;
  actor = seeded.demoMembers.northstar;
});
afterAll(() => cleanup());

const deps = (workspaceId = ws) => {
  const outbox = new DrizzleEmailOutbox(db, workspaceId);
  return {
    orders: new DrizzleOrderRepository(db, workspaceId),
    payments: new DrizzlePaymentRepository(db, workspaceId),
    customers: new DrizzleCustomerRepository(db, workspaceId),
    activity: new DrizzleActivityRepository(db, workspaceId),
    invoices: new DrizzleInvoiceRepository(db, workspaceId),
    outbox,
    clock: () => now,
    sendEmail: makeSendEmail({ outbox, mailer: fakeMailer, clock: () => now }),
  };
};

const issuer = { issuer: "Northstar Studio", baseUrl: "https://app.example.test" };

describe("listInvoices", () => {
  it("lists only issued invoices (invoiced or completed with an invoice number)", async () => {
    const page = await makeListInvoices(deps())({ tab: "all", page: 1, pageSize: 100 });
    expect(page.total).toBeGreaterThan(0);
    for (const invoice of page.items) {
      expect(invoice.invoiceNumber).toMatch(/^INV-/);
      expect(["invoiced", "completed"]).toContain(invoice.status);
    }
  });

  it("filters by tab: overdue, open and paid", async () => {
    const list = makeListInvoices(deps());
    const overdue = await list({ tab: "overdue", page: 1, pageSize: 100 });
    expect(overdue.items.map((i) => i.invoiceNumber)).toEqual(expect.arrayContaining(["INV-2018", "INV-2023"]));
    expect(overdue.items.every((i) => i.status === "invoiced" && i.dueDate < new Date("2026-10-14T00:00:00Z"))).toBe(true);
    const open = await list({ tab: "open", page: 1, pageSize: 100 });
    expect(open.items.map((i) => i.invoiceNumber)).toContain("INV-2047");
    expect(open.items.some((i) => i.invoiceNumber === "INV-2018")).toBe(false);
    const paid = await list({ tab: "paid", page: 1, pageSize: 100 });
    expect(paid.items.length).toBeGreaterThan(0);
    expect(paid.items.every((i) => i.status === "completed")).toBe(true);
  });

  it("searches by invoice number or client and filters by customer and issue date", async () => {
    const list = makeListInvoices(deps());
    const byNumber = await list({ tab: "all", search: "INV-2047", page: 1, pageSize: 10 });
    expect(byNumber.items.map((i) => i.customerCompany)).toEqual(["Hyperion Media Group"]);
    const byClient = await list({ tab: "all", search: "aura health", page: 1, pageSize: 10 });
    expect(byClient.items.map((i) => i.invoiceNumber)).toContain("INV-2018");
    const aura = byClient.items.find((i) => i.invoiceNumber === "INV-2018")!;
    const byCustomer = await list({ tab: "all", customerId: aura.customerId, page: 1, pageSize: 50 });
    expect(byCustomer.items.every((i) => i.customerId === aura.customerId)).toBe(true);
    const recent = await list({ tab: "all", issuedFrom: new Date("2026-10-08T00:00:00Z"), page: 1, pageSize: 50 });
    expect(recent.items.every((i) => i.issueDate >= new Date("2026-10-08T00:00:00Z"))).toBe(true);
    expect(recent.items.some((i) => i.invoiceNumber === "INV-2018")).toBe(false);
  });

  it("never returns invoices of another workspace", async () => {
    const sandbox = await makeListInvoices(deps(sandboxWs))({ tab: "all", page: 1, pageSize: 100 });
    expect(sandbox.items.map((i) => i.customerCompany).sort()).toEqual(["Polaris Mobility", "Quanta Bioworks"]);
    const search = await makeListInvoices(deps(sandboxWs))({ tab: "all", search: "INV-2047", page: 1, pageSize: 10 });
    expect(search.total).toBe(0);
  });
});

describe("getInvoiceOverview", () => {
  it("computes KPIs and tab counts from this workspace's invoices", async () => {
    const overview = await makeGetInvoiceOverview(deps())();
    expect(overview.counts.overdue).toBeGreaterThanOrEqual(2);
    expect(overview.counts.all).toBe(overview.counts.open + overview.counts.overdue + overview.counts.paid);
    expect(overview.kpis.overdueCents).toBeGreaterThan(0);
    expect(overview.kpis.overdueCount).toBe(overview.counts.overdue);
    expect(overview.kpis.outstandingCents).toBeGreaterThanOrEqual(overview.kpis.overdueCents);
    const sandbox = await makeGetInvoiceOverview(deps(sandboxWs))();
    expect(sandbox.counts.all).toBe(2);
  });
});

describe("getInvoice", () => {
  it("returns the invoice with items, customer billing info and payments, scoped to the workspace", async () => {
    const invoice = await makeGetInvoice(deps())("INV-2047");
    expect(invoice?.order.customerCompany).toBe("Hyperion Media Group");
    expect(invoice?.order.items).toHaveLength(2);
    expect(invoice?.customer.contactEmail).toContain("@");
    expect(Array.isArray(invoice?.payments)).toBe(true);
    expect(await makeGetInvoice(deps(sandboxWs))("INV-2047")).toBeNull();
    const sandboxInvoice = await makeGetInvoice(deps(sandboxWs))("INV-1900");
    expect(sandboxInvoice?.order.customerCompany).toBe("Quanta Bioworks");
  });

  it("returns null for unknown numbers", async () => {
    expect(await makeGetInvoice(deps())("INV-0000")).toBeNull();
  });
});

describe("sendInvoice", () => {
  it("emails the customer's billing or contact address through the outbox and records activity", async () => {
    delivered.length = 0;
    const d = deps();
    const result = await makeSendInvoice(d)("INV-2047", actor, issuer);
    expect(result.email.kind).toBe("invoice");
    expect(result.email.status).toBe("logged");
    expect(result.email.relatedEntityType).toBe("order");
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.to).toBe(result.recipient);
    expect(delivered[0]!.subject).toBe("Invoice INV-2047 from Northstar Studio");
    expect(delivered[0]!.text).toContain("https://app.example.test/invoices/INV-2047");
    const stored = await d.outbox.findById(result.email.id);
    expect(stored?.createdById).toBe(actor);
    const recent = await d.activity.recent(1);
    expect(recent[0]?.message).toContain("sent invoice #INV-2047");
  });

  it("reports a failed delivery without throwing", async () => {
    failDelivery = true;
    try {
      const result = await makeSendInvoice(deps())("INV-2047", actor, issuer);
      expect(result.email.status).toBe("failed");
      expect(result.email.error).toContain("SMTP down");
    } finally {
      failDelivery = false;
    }
  });

  it("refuses unknown or foreign invoices", async () => {
    await expect(makeSendInvoice(deps(sandboxWs))("INV-2047", actor, issuer)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("sendInvoiceReminder", () => {
  it("sends a reminder email for an overdue invoice", async () => {
    delivered.length = 0;
    const result = await makeSendInvoiceReminder(deps())("INV-2018", actor, issuer);
    expect(result.email.kind).toBe("reminder");
    expect(delivered[0]!.subject).toMatch(/^Reminder: invoice INV-2018 is \d+ days overdue$/);
  });

  it("refuses reminders for paid invoices", async () => {
    const paid = await makeListInvoices(deps())({ tab: "paid", page: 1, pageSize: 1 });
    const number = paid.items[0]!.invoiceNumber!;
    await expect(makeSendInvoiceReminder(deps())(number, actor, issuer)).rejects.toBeInstanceOf(InvoiceActionError);
  });
});

describe("listInvoiceableOrders", () => {
  it("lists pending and processing orders that can be invoiced, and issuing one makes it an invoice", async () => {
    const d = deps();
    const apex = (await d.customers.findByCompany("Apex Digital Labs"))!;
    const order = await makeCreateOrder(d)(
      { customerId: apex.id, title: "Invoice me", category: "custom_software", paymentTerms: "net_30", status: "pending", items: [{ title: "Work", quantity: 1, unitRateCents: 10_000 }] },
      actor,
    );
    const ready = await makeListInvoiceableOrders(d)();
    expect(ready.map((o) => o.reference)).toContain(order.reference);
    expect(ready.every((o) => o.status === "pending" || o.status === "processing")).toBe(true);
    await makeChangeOrderStatus(d)(order.reference, "invoiced", actor);
    const after = await makeListInvoiceableOrders(d)();
    expect(after.map((o) => o.reference)).not.toContain(order.reference);
    const issued = await d.orders.findByReference(order.reference);
    expect(await makeGetInvoice(d)(issued!.invoiceNumber!)).not.toBeNull();
    const sandboxReady = await makeListInvoiceableOrders(deps(sandboxWs))();
    expect(sandboxReady.map((o) => o.reference)).not.toContain(order.reference);
  });
});
