import { dueDateFor, type OrderCategory, type OrderStatus } from "../../../modules/sales/domain/order";
import type { Database } from "../connect";
import { activityEvents, customers, members, orderItems, orders, taskSubtasks, tasks } from "../schema";
import {
  ACTIVITY,
  CUSTOMERS,
  DESIGN_ORDERS,
  HISTORY_MONTHLY_TARGETS,
  HISTORY_TITLES,
  MEMBERS,
  OVERDUE_ORDERS,
  TASKS,
  type OrderFixture,
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
}

/** Wipes all business tables and inserts the demo dataset relative to `now`. */
export async function seedDatabase(db: Database, now: Date): Promise<SeedSummary> {
  await db.delete(activityEvents);
  await db.delete(taskSubtasks);
  await db.delete(tasks);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(customers);
  await db.delete(members);

  const memberRows = await db
    .insert(members)
    .values(MEMBERS.map((m) => ({ ...m, createdAt: new Date(now.getTime() - 400 * DAY) })))
    .returning({ id: members.id, name: members.name });
  const memberId = new Map(memberRows.map((m) => [m.name, m.id]));

  const customerRows = await db
    .insert(customers)
    .values(
      CUSTOMERS.map((c) => ({
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
  const customerId = new Map(customerRows.map((c) => [c.company, c.id]));

  const atDaysAgo = (o: OrderFixture): PlannedOrder => ({ ...o, issueDate: new Date(now.getTime() - o.issuedDaysAgo * DAY) });
  const planned = [...generateHistory(now), ...OVERDUE_ORDERS.map(atDaysAgo), ...DESIGN_ORDERS.map(atDaysAgo)].sort(
    (a, b) => a.issueDate.getTime() - b.issueDate.getTime(),
  );

  // References end at SL-1048 (the latest order in the design's sales register).
  const firstReference = 1048 - planned.length + 1;
  let invoiceSequence = 1900;
  for (const [index, o] of planned.entries()) {
    const id = customerId.get(o.customer);
    if (!id) throw new Error(`Unknown seed customer: ${o.customer}`);
    const terms = o.paymentTerms ?? "net_30";
    const dueDate = dueDateFor(o.issueDate, terms);
    const invoiced: OrderStatus[] = ["invoiced", "completed"];
    const invoiceNumber = o.invoiceNumber ?? (invoiced.includes(o.status) ? `INV-${invoiceSequence++}` : null);
    const paidAt = o.status === "completed" ? new Date(Math.min(o.issueDate.getTime() + 18 * DAY, now.getTime())) : null;

    const [order] = await db
      .insert(orders)
      .values({
        reference: `SL-${firstReference + index}`,
        customerId: id,
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

  const localDate = ([days, hour, minute]: [number, number, number]) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  for (const [position, t] of TASKS.entries()) {
    const [task] = await db
      .insert(tasks)
      .values({
        code: t.code,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        customerId: t.customer ? (customerId.get(t.customer) ?? null) : null,
        assigneeId: t.assignee ? (memberId.get(t.assignee) ?? null) : null,
        dueAt: t.due ? localDate(t.due) : null,
        estimateHours: t.estimateHours ?? null,
        trackedHours: t.trackedHours ?? 0,
        blockedReason: t.blockedReason ?? null,
        tags: t.tags ?? [],
        commentCount: t.commentCount ?? 0,
        position,
        completedAt: t.completedDaysAgo !== undefined ? new Date(now.getTime() - t.completedDaysAgo * DAY) : null,
        createdAt: new Date(now.getTime() - 14 * DAY),
        updatedAt: new Date(now.getTime() - DAY),
      })
      .returning({ id: tasks.id });
    if (t.subtasks?.length) {
      await db
        .insert(taskSubtasks)
        .values(t.subtasks.map(([title, done], i) => ({ taskId: task!.id, title, done, position: i })));
    }
  }

  await db.insert(activityEvents).values(
    ACTIVITY.map((a) => ({
      actorId: memberId.get(a.actor) ?? null,
      message: a.message,
      category: a.category,
      createdAt: new Date(now.getTime() - a.minutesAgo * 60_000),
    })),
  );

  return {
    members: memberRows.length,
    customers: customerRows.length,
    orders: planned.length,
    tasks: TASKS.length,
    activity: ACTIVITY.length,
  };
}
