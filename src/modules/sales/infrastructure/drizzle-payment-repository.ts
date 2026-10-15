import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { members, orders, payments } from "@/server/db/schema";
import { NotFoundError } from "../../shared-types";
import type { NewPayment, Payment, PaymentRecorded, PaymentRepository } from "../application/ports";
import { assertPaymentAllowed, orderBalance, statusAfterPayment } from "../domain/payment";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

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

  /** Order state read inside the caller's transaction (libSQL write transactions serialize writers). */
  private async payableOrder(tx: Transaction, orderId: number) {
    const [order] = await tx
      .select({ status: orders.status, amountCents: orders.amountCents })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.workspaceId, this.workspaceId)));
    if (!order) throw new NotFoundError("Order", orderId);
    const [paid] = await tx
      .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number) })
      .from(payments)
      .where(eq(payments.orderId, orderId));
    return { ...order, paidCents: paid?.cents ?? 0 };
  }

  private async insert(tx: Transaction, payment: NewPayment, now: Date) {
    const [created] = await tx
      .insert(payments)
      .values({ ...payment, reference: payment.reference ?? null, note: payment.note ?? null, workspaceId: this.workspaceId, createdAt: now })
      .returning({ id: payments.id });
    return created!.id;
  }

  async record(payment: NewPayment, now: Date): Promise<PaymentRecorded> {
    const { id, paidCents, completed } = await this.db.transaction(async (tx) => {
      const order = await this.payableOrder(tx, payment.orderId);
      assertPaymentAllowed(order, payment.amountCents);
      const id = await this.insert(tx, payment, now);
      const paidCents = order.paidCents + payment.amountCents;
      const next = statusAfterPayment(order.status, order.amountCents, paidCents);
      if (next) {
        await tx
          .update(orders)
          .set({ status: next, paidAt: payment.paidAt, updatedAt: now })
          .where(and(eq(orders.id, payment.orderId), eq(orders.workspaceId, this.workspaceId)));
      }
      return { id, paidCents, completed: next === "completed" };
    });
    return { payment: (await this.findById(id))!, paidCents, completed };
  }

  async settleBalance(payment: Omit<NewPayment, "amountCents">, now: Date) {
    const id = await this.db.transaction(async (tx) => {
      const balance = orderBalance(await this.payableOrder(tx, payment.orderId));
      return balance > 0 ? this.insert(tx, { ...payment, amountCents: balance }, now) : null;
    });
    return id === null ? null : this.findById(id);
  }

  async delete(id: number) {
    const deleted = await this.db.delete(payments).where(this.inWorkspace(eq(payments.id, id))).returning({ id: payments.id });
    return deleted.length > 0;
  }
}
