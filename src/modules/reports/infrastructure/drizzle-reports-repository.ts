import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, members, orders, payments, tasks, taskTimeEntries } from "@/server/db/schema";
import type { ReportsRepository } from "../application/ports";
import type { DateRange } from "../domain/reports";

/** Report facts read from one workspace's orders, payments, tasks and time entries. */
export class DrizzleReportsRepository implements ReportsRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  orderFacts() {
    return this.db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        customerCompany: customers.company,
        category: orders.category,
        status: orders.status,
        amountCents: orders.amountCents,
        paidCents: sql<number>`coalesce((select sum(p.amount_cents) from payments p where p.order_id = "orders"."id"), 0)`.mapWith(Number),
        invoiceNumber: orders.invoiceNumber,
        issueDate: orders.issueDate,
        dueDate: orders.dueDate,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(eq(orders.workspaceId, this.workspaceId));
  }

  paymentFacts({ start, end }: DateRange) {
    return this.db
      .select({ orderId: payments.orderId, customerId: orders.customerId, amountCents: payments.amountCents, paidAt: payments.paidAt })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(payments.workspaceId, this.workspaceId), eq(orders.workspaceId, this.workspaceId), gte(payments.paidAt, start), lt(payments.paidAt, end)));
  }

  taskFacts() {
    return this.db
      .select({
        id: tasks.id,
        status: tasks.status,
        assigneeId: tasks.assigneeId,
        assigneeName: members.name,
        createdAt: tasks.createdAt,
        completedAt: tasks.completedAt,
        dueAt: tasks.dueAt,
      })
      .from(tasks)
      .leftJoin(members, and(eq(members.id, tasks.assigneeId), eq(members.workspaceId, this.workspaceId)))
      .where(eq(tasks.workspaceId, this.workspaceId));
  }

  timeEntries({ start, end }: DateRange) {
    return this.db
      .select({
        memberId: taskTimeEntries.memberId,
        memberName: members.name,
        taskId: taskTimeEntries.taskId,
        minutes: taskTimeEntries.minutes,
        loggedAt: taskTimeEntries.loggedAt,
      })
      .from(taskTimeEntries)
      .innerJoin(tasks, eq(tasks.id, taskTimeEntries.taskId))
      .leftJoin(members, and(eq(members.id, taskTimeEntries.memberId), eq(members.workspaceId, this.workspaceId)))
      .where(and(eq(tasks.workspaceId, this.workspaceId), gte(taskTimeEntries.loggedAt, start), lt(taskTimeEntries.loggedAt, end)));
  }
}
