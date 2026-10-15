import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { ActivityCategory } from "../../../modules/activity/domain/activity";
import type { CustomerStatus, CustomerTier } from "../../../modules/customers/domain/customer";
import { dueDateFor, type OrderCategory, type OrderStatus, type PaymentTerms } from "../../../modules/sales/domain/order";
import type { WorkspaceRole } from "../../../modules/workspaces/domain/workspace";
import type { Database } from "../connect";
import {
  account,
  activityEvents,
  customers,
  members,
  orderItems,
  orders,
  session,
  taskSubtasks,
  tasks,
  user,
  verification,
  workspaceMemberships,
  workspaces,
} from "../schema";
import {
  ACTIVITY,
  CUSTOMERS,
  DEMO_USER,
  DESIGN_ORDERS,
  HISTORY_MONTHLY_TARGETS,
  HISTORY_TITLES,
  MEMBERS,
  NORTHSTAR_WORKSPACE,
  OVERDUE_ORDERS,
  SANDBOX_WORKSPACE,
  TASKS,
  type OrderFixture,
  type TaskFixture,
} from "./data";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Small deterministic PRNG so every reset produces the same dataset. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlannedOrder extends OrderFixture {
  issueDate: Date;
}

function generateHistory(now: Date): PlannedOrder[] {
  const random = mulberry32(42);
  const pool = CUSTOMERS.filter((c) => c.historyWeight > 0);
  const totalWeight = pool.reduce((s, c) => s + c.historyWeight, 0);
  const pickCustomer = () => {
    let r = random() * totalWeight;
    for (const c of pool) {
      r -= c.historyWeight;
      if (r <= 0) return c;
    }
    return pool[pool.length - 1]!;
  };

  const planned: PlannedOrder[] = [];
  HISTORY_MONTHLY_TARGETS.forEach((target, index) => {
    const monthsBack = HISTORY_MONTHLY_TARGETS.length - index;
    let remaining = target;
    while (remaining >= 50_000) {
      const amount = Math.min(remaining, Math.round((90_000 + random() * 390_000) / 5_000) * 5_000);
      const customer = pickCustomer();
      const category: OrderCategory = customer.categories[Math.floor(random() * customer.categories.length)]!;
      const titles = HISTORY_TITLES[category];
      const day = 1 + Math.floor(random() * 27);
      const issueDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, day, 10, 0, 0, 0);
      planned.push({
        customer: customer.company,
        title: titles[Math.floor(random() * titles.length)]!,
        category,
        status: "completed",
        amountCents: amount,
        issuedDaysAgo: Math.round((now.getTime() - issueDate.getTime()) / DAY),
        issueDate,
      });
      remaining -= amount;
    }
  });

  // A couple of cancelled engagements (excluded from revenue) for realism.
  for (const daysAgo of [130, 75]) {
    planned.push({
      customer: "Terra Firma Design",
      title: "Showroom Configurator Pilot",
      category: "ux_ui_retainer",
      status: "cancelled",
      amountCents: 180_000,
      issuedDaysAgo: daysAgo,
      issueDate: new Date(now.getTime() - daysAgo * DAY),
    });
  }
  return planned;
}

export interface SeedSummary {
  members: number;
  customers: number;
  orders: number;
  tasks: number;
  activity: number;
  demoUserId: string;
  workspaces: { northstar: number; sandbox: number };
}

type Lookup = Map<string, number>;

function lookup(map: Lookup, key: string, kind: string): number {
  const id = map.get(key);
  if (id === undefined) throw new Error(`Unknown seed ${kind}: ${key}`);
  return id;
}

/** Inserts a workspace with its members; members whose email matches the demo user are linked to the login. */
async function insertWorkspace(
  db: Database,
  now: Date,
  workspace: { name: string; slug: string; tagline: string },
  people: ReadonlyArray<{ name: string; email: string; role: string }>,
  owner: { userId: string; email: string; role: WorkspaceRole },
) {
  const [row] = await db
    .insert(workspaces)
    .values({ ...workspace, createdAt: new Date(now.getTime() - 400 * DAY) })
    .returning({ id: workspaces.id });
  const workspaceId = row!.id;
  const memberRows = await db
    .insert(members)
    .values(
      people.map((m) => ({
        ...m,
        workspaceId,
        userId: m.email === owner.email ? owner.userId : null,
        createdAt: new Date(now.getTime() - 400 * DAY),
      })),
    )
    .returning({ id: members.id, name: members.name, email: members.email });
  const ownerMember = memberRows.find((m) => m.email === owner.email);
  if (!ownerMember) throw new Error(`Seed workspace ${workspace.name} has no member for ${owner.email}`);
  await db.insert(workspaceMemberships).values({ workspaceId, userId: owner.userId, memberId: ownerMember.id, role: owner.role });
  return { workspaceId, memberId: new Map(memberRows.map((m) => [m.name, m.id])) as Lookup };
}

interface CustomerSeed {
  company: string;
  tier: CustomerTier;
  status: CustomerStatus;
  industry: string;
  contactName: string;
  contactEmail: string;
  billingEmail?: string;
  paymentTerms?: PaymentTerms;
  lastActiveHoursAgo: number;
}

async function insertCustomers(db: Database, now: Date, workspaceId: number, list: ReadonlyArray<CustomerSeed>): Promise<Lookup> {
  const rows = await db
    .insert(customers)
    .values(
      list.map((c) => ({
        workspaceId,
        company: c.company,
        tier: c.tier,
        status: c.status,
        industry: c.industry,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        billingEmail: c.billingEmail ?? null,
        paymentTerms: c.paymentTerms ?? "net_30",
        lastActivityAt: new Date(now.getTime() - c.lastActiveHoursAgo * HOUR),
        createdAt: new Date(now.getTime() - 240 * DAY),
        updatedAt: new Date(now.getTime() - c.lastActiveHoursAgo * HOUR),
      })),
    )
    .returning({ id: customers.id, company: customers.company });
  return new Map(rows.map((c) => [c.company, c.id]));
}

/** Inserts orders oldest first with consecutive references starting at `firstReference`. */
async function insertOrders(
  db: Database,
  now: Date,
  workspaceId: number,
  customerId: Lookup,
  planned: ReadonlyArray<PlannedOrder>,
  firstReference: number,
) {
  let invoiceSequence = 1900;
  for (const [index, o] of planned.entries()) {
    const terms = o.paymentTerms ?? "net_30";
    const dueDate = dueDateFor(o.issueDate, terms);
    const invoiced: OrderStatus[] = ["invoiced", "completed"];
    const invoiceNumber = o.invoiceNumber ?? (invoiced.includes(o.status) ? `INV-${invoiceSequence++}` : null);
    const paidAt = o.status === "completed" ? new Date(Math.min(o.issueDate.getTime() + 18 * DAY, now.getTime())) : null;

    const [order] = await db
      .insert(orders)
      .values({
        workspaceId,
        reference: `SL-${firstReference + index}`,
        customerId: lookup(customerId, o.customer, "customer"),
        title: o.title,
        description: o.description ?? null,
        category: o.category,
        status: o.status,
        paymentTerms: terms,
        subtotalCents: o.amountCents,
        discountCents: 0,
        taxCents: 0,
        amountCents: o.amountCents,
        invoiceNumber,
        issueDate: o.issueDate,
        dueDate,
        paidAt,
        createdAt: o.issueDate,
        updatedAt: paidAt ?? o.issueDate,
      })
      .returning({ id: orders.id });

    const items = o.items ?? [{ title: o.title, description: o.description, quantity: 1, unitRateCents: o.amountCents }];
    await db.insert(orderItems).values(
      items.map((item, position) => ({
        orderId: order!.id,
        position,
        title: item.title,
        description: item.description ?? null,
        quantity: item.quantity,
        unit: item.unit ?? "unit",
        unitRateCents: item.unitRateCents,
      })),
    );
  }
}

type TaskSeed = Omit<TaskFixture, "assignee"> & { assignee: string | null };

async function insertTasks(db: Database, now: Date, workspaceId: number, customerId: Lookup, memberId: Lookup, list: ReadonlyArray<TaskSeed>) {
  const localDate = ([days, hour, minute]: readonly [number, number, number]) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  for (const [position, t] of list.entries()) {
    const [task] = await db
      .insert(tasks)
      .values({
        workspaceId,
        code: t.code,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        customerId: t.customer ? lookup(customerId, t.customer, "customer") : null,
        assigneeId: t.assignee ? lookup(memberId, t.assignee, "member") : null,
        dueAt: t.due ? localDate(t.due) : null,
        estimateHours: t.estimateHours ?? null,
        trackedHours: t.trackedHours ?? 0,
        blockedReason: t.blockedReason ?? null,
        tags: t.tags ? [...t.tags] : [],
        commentCount: t.commentCount ?? 0,
        position,
        completedAt: t.completedDaysAgo !== undefined ? new Date(now.getTime() - t.completedDaysAgo * DAY) : null,
        createdAt: new Date(now.getTime() - 14 * DAY),
        updatedAt: new Date(now.getTime() - DAY),
      })
      .returning({ id: tasks.id });
    if (t.subtasks?.length) {
      await db.insert(taskSubtasks).values(t.subtasks.map(([title, done], i) => ({ taskId: task!.id, title, done, position: i })));
    }
  }
}

async function insertActivity(
  db: Database,
  now: Date,
  workspaceId: number,
  memberId: Lookup,
  list: ReadonlyArray<{ actor: string; message: string; category: ActivityCategory; minutesAgo: number }>,
) {
  await db.insert(activityEvents).values(
    list.map((a) => ({
      workspaceId,
      actorId: lookup(memberId, a.actor, "member"),
      message: a.message,
      category: a.category,
      createdAt: new Date(now.getTime() - a.minutesAgo * 60_000),
    })),
  );
}

/** Wipes every table and inserts the demo login plus two workspaces, with dates relative to `now`. */
export async function seedDatabase(db: Database, now: Date): Promise<SeedSummary> {
  for (const table of [activityEvents, taskSubtasks, tasks, orderItems, orders, customers, workspaceMemberships, members, workspaces]) {
    await db.delete(table);
  }
  for (const table of [session, account, verification, user]) await db.delete(table);

  // Demo login stored exactly like a Better Auth email + password sign-up ("credential" account).
  const demoUserId = randomUUID();
  await db.insert(user).values({ id: demoUserId, name: DEMO_USER.name, email: DEMO_USER.email, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: demoUserId,
    providerId: "credential",
    userId: demoUserId,
    password: await hashPassword(DEMO_USER.password),
    createdAt: now,
    updatedAt: now,
  });
  const owner = { userId: demoUserId, email: DEMO_USER.email, role: "owner" as const };

  // Northstar Studio: the dataset of the Stitch designs.
  const north = await insertWorkspace(db, now, NORTHSTAR_WORKSPACE, MEMBERS, owner);
  const northCustomers = await insertCustomers(db, now, north.workspaceId, CUSTOMERS);
  const atDaysAgo = (o: OrderFixture): PlannedOrder => ({ ...o, issueDate: new Date(now.getTime() - o.issuedDaysAgo * DAY) });
  const planned = [...generateHistory(now), ...OVERDUE_ORDERS.map(atDaysAgo), ...DESIGN_ORDERS.map(atDaysAgo)].sort(
    (a, b) => a.issueDate.getTime() - b.issueDate.getTime(),
  );
  // References end at SL-1048 (the latest order in the design's sales register).
  await insertOrders(db, now, north.workspaceId, northCustomers, planned, 1048 - planned.length + 1);
  await insertTasks(db, now, north.workspaceId, northCustomers, north.memberId, TASKS);
  await insertActivity(db, now, north.workspaceId, north.memberId, ACTIVITY);

  // Helix Labs Sandbox: a small second workspace (its references and invoice numbers overlap Northstar's on purpose).
  const sandbox = await insertWorkspace(db, now, SANDBOX_WORKSPACE, SANDBOX_WORKSPACE.members, owner);
  const sandboxCustomers = await insertCustomers(db, now, sandbox.workspaceId, SANDBOX_WORKSPACE.customers);
  await insertOrders(db, now, sandbox.workspaceId, sandboxCustomers, SANDBOX_WORKSPACE.orders.map(atDaysAgo), 1001);
  await insertTasks(db, now, sandbox.workspaceId, sandboxCustomers, sandbox.memberId, SANDBOX_WORKSPACE.tasks);
  await insertActivity(db, now, sandbox.workspaceId, sandbox.memberId, SANDBOX_WORKSPACE.activity);

  return {
    members: MEMBERS.length + SANDBOX_WORKSPACE.members.length,
    customers: CUSTOMERS.length + SANDBOX_WORKSPACE.customers.length,
    orders: planned.length + SANDBOX_WORKSPACE.orders.length,
    tasks: TASKS.length + SANDBOX_WORKSPACE.tasks.length,
    activity: ACTIVITY.length + SANDBOX_WORKSPACE.activity.length,
    demoUserId,
    workspaces: { northstar: north.workspaceId, sandbox: sandbox.workspaceId },
  };
}
