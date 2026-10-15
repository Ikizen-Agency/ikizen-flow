import "server-only";
import type { Database } from "@/server/db/connect";
import { orders } from "@/server/db/schema";
import type { DashboardRepository } from "../application/ports";

export class DrizzleDashboardRepository implements DashboardRepository {
  constructor(private readonly db: Database) {}

  orderFacts() {
    return this.db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        category: orders.category,
        status: orders.status,
        amountCents: orders.amountCents,
        issueDate: orders.issueDate,
        dueDate: orders.dueDate,
        paidAt: orders.paidAt,
      })
      .from(orders);
  }
}
