import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { orders } from "@/server/db/schema";
import type { DashboardRepository } from "../application/ports";

export class DrizzleDashboardRepository implements DashboardRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

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
      .from(orders)
      .where(eq(orders.workspaceId, this.workspaceId));
  }
}
