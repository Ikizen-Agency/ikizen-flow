import "server-only";
import { and, desc, eq, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, orders, payments } from "@/server/db/schema";
import { NotFoundError } from "../../shared-types";
import type { NewPayment, Payment, PaymentRepository } from "../application/ports";

const paymentColumns = {
  id: payments.id,
  orderId: payments.orderId,
  amountCents: payments.amountCents,
  method: payments.method,
  paidAt: payments.paidAt,
  reference: payments.reference,
  note: payments.note,
  recordedById: payments.recordedById,
  recordedByName: members.name,
  createdAt: payments.createdAt,
};

/** Payments of one workspace: every query is filtered by `workspaceId`. */
export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private inWorkspace(...filters: Array<SQL | undefined>) {
    return and(eq(payments.workspaceId, this.workspaceId), ...filters);
  }

  listForOrder(orderId: number): Promise<Payment[]> {
    return this.db
      .select(paymentColumns)
      .from(payments)
      .leftJoin(members, eq(members.id, payments.recordedById))
      .where(this.inWorkspace(eq(payments.orderId, orderId)))
      .orderBy(desc(payments.paidAt), desc(payments.id));
  }

  async findById(id: number) {
    const [row] = await this.db
      .select(paymentColumns)
      .from(payments)
      .leftJoin(members, eq(members.id, payments.recordedById))
      .where(this.inWorkspace(eq(payments.id, id)));
    return row ?? null;
  }

  async create(payment: NewPayment, now: Date) {
    const [order] = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, payment.orderId), eq(orders.workspaceId, this.workspaceId)));
    if (!order) throw new NotFoundError("Order", payment.orderId);
    const [created] = await this.db
      .insert(payments)
      .values({ ...payment, reference: payment.reference ?? null, note: payment.note ?? null, workspaceId: this.workspaceId, createdAt: now })
      .returning({ id: payments.id });
    return (await this.findById(created!.id))!;
  }

  async delete(id: number) {
    const deleted = await this.db.delete(payments).where(this.inWorkspace(eq(payments.id, id))).returning({ id: payments.id });
    return deleted.length > 0;
  }
}
