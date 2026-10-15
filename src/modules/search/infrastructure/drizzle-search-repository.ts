import "server-only";
import { and, asc, desc, eq, or, sql, type SQL, type AnyColumn } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, orders, tasks } from "@/server/db/schema";
import type { SearchRepository } from "../application/ports";

/** Case-insensitive LIKE with `\` as the escape character (patterns come from `likePattern`). */
const like = (column: AnyColumn, pattern: string): SQL => sql`${column} like ${pattern} escape '\\'`;

/** Global search over one workspace's customers, orders and tasks. */
export class DrizzleSearchRepository implements SearchRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  customers(pattern: string, limit: number) {
    return this.db
      .select({ id: customers.id, company: customers.company, contactName: customers.contactName })
      .from(customers)
      .where(and(eq(customers.workspaceId, this.workspaceId), or(like(customers.company, pattern), like(customers.contactName, pattern))))
      .orderBy(asc(customers.company))
      .limit(limit);
  }

  orders(pattern: string, limit: number) {
    return this.db
      .select({ reference: orders.reference, title: orders.title, invoiceNumber: orders.invoiceNumber, customerCompany: customers.company })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orders.workspaceId, this.workspaceId),
          or(like(orders.reference, pattern), like(orders.invoiceNumber, pattern), like(orders.title, pattern), like(orders.description, pattern)),
        ),
      )
      .orderBy(desc(orders.issueDate), desc(orders.id))
      .limit(limit);
  }

  tasks(pattern: string, limit: number) {
    return this.db
      .select({ id: tasks.id, code: tasks.code, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, this.workspaceId), or(like(tasks.code, pattern), like(tasks.title, pattern))))
      .orderBy(desc(tasks.updatedAt), desc(tasks.id))
      .limit(limit);
  }
}
