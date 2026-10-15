import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, orders, payments } from "@/server/db/schema";
import { INVOICED_ORDER_STATUSES } from "../../sales/domain/order";
import type { InvoiceableOrder, InvoiceRepository } from "../application/ports";

// Qualified by hand: in a single-table select Drizzle renders `${orders.id}` unqualified, which would bind to `p.id`.
const paidCents = sql<number>`coalesce((select sum(p.amount_cents) from payments p where p.order_id = "orders"."id"), 0)`.mapWith(Number);

/** Invoice read model over `orders` / `payments` of one workspace. */
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private issued() {
    return and(eq(orders.workspaceId, this.workspaceId), isNotNull(orders.invoiceNumber), inArray(orders.status, [...INVOICED_ORDER_STATUSES]));
  }

  facts() {
    return this.db
      .select({
        status: orders.status,
        amountCents: orders.amountCents,
        paidCents,
        issueDate: orders.issueDate,
        dueDate: orders.dueDate,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .where(this.issued());
  }

  paymentsBetween(from: Date, to: Date) {
    return this.db
      .select({ amountCents: payments.amountCents, paidAt: payments.paidAt })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(payments.workspaceId, this.workspaceId), this.issued(), gte(payments.paidAt, from), lt(payments.paidAt, to)));
  }

  async referenceFor(invoiceNumber: string) {
    const [row] = await this.db
      .select({ reference: orders.reference })
      .from(orders)
      .where(and(this.issued(), eq(orders.invoiceNumber, invoiceNumber)))
      .limit(1);
    return row?.reference ?? null;
  }

  invoiceable(limit: number): Promise<InvoiceableOrder[]> {
    return this.db
      .select({
        reference: orders.reference,
        customerCompany: customers.company,
        title: orders.title,
        status: orders.status,
        amountCents: orders.amountCents,
        issueDate: orders.issueDate,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.workspaceId, this.workspaceId), inArray(orders.status, ["pending", "processing"])))
      .orderBy(desc(orders.issueDate), desc(orders.id))
      .limit(limit);
  }
}
