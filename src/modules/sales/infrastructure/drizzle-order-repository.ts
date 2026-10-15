import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, like, lt, lte, notExists, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, orderItems, orders, payments } from "@/server/db/schema";
import { INVOICED_ORDER_STATUSES, OPEN_ORDER_STATUSES, ORDER_STATUSES, overdueCutoff, type EffectiveOrderStatus, type OrderStatus } from "../domain/order";
import { NotFoundError } from "../../shared-types";
import type { NewOrder, Order, OrderListQuery, OrderRepository, OrderStatusChange, OrderUpdate } from "../application/ports";

const orderColumns = {
  id: orders.id,
  reference: orders.reference,
  customerId: orders.customerId,
  customerCompany: customers.company,
  title: orders.title,
  description: orders.description,
  category: orders.category,
  status: orders.status,
  paymentTerms: orders.paymentTerms,
  subtotalCents: orders.subtotalCents,
  discountCents: orders.discountCents,
  taxCents: orders.taxCents,
  amountCents: orders.amountCents,
  invoiceNumber: orders.invoiceNumber,
  issueDate: orders.issueDate,
  dueDate: orders.dueDate,
  paidAt: orders.paidAt,
  paidCents: sql<number>`coalesce((select sum(p.amount_cents) from payments p where p.order_id = ${orders.id}), 0)`.mapWith(Number),
};

/** SQL for a display status: overdue is derived from open status + due date, never stored. */
function effectiveStatusFilter(status: EffectiveOrderStatus, asOf: Date): SQL {
  const cutoff = overdueCutoff(asOf);
  if (status === "overdue") return and(inArray(orders.status, [...OPEN_ORDER_STATUSES]), lt(orders.dueDate, cutoff))!;
  if (OPEN_ORDER_STATUSES.includes(status)) return and(eq(orders.status, status), gte(orders.dueDate, cutoff))!;
  return eq(orders.status, status);
}

/** Orders of one workspace: every query is filtered by `workspaceId`. */
export class DrizzleOrderRepository implements OrderRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private inWorkspace(...filters: Array<SQL | undefined>) {
    return and(eq(orders.workspaceId, this.workspaceId), ...filters);
  }

  async list({ status, asOf = new Date(), customerId, search, issuedFrom, issuedTo, invoicedOnly, page = 1, pageSize = 20 }: OrderListQuery) {
    const filters: SQL[] = [eq(orders.workspaceId, this.workspaceId)];
    if (invoicedOnly) filters.push(isNotNull(orders.invoiceNumber), inArray(orders.status, [...INVOICED_ORDER_STATUSES]));
    if (status) filters.push(effectiveStatusFilter(status, asOf));
    if (customerId) filters.push(eq(orders.customerId, customerId));
    if (issuedFrom) filters.push(gte(orders.issueDate, issuedFrom));
    if (issuedTo) filters.push(lte(orders.issueDate, issuedTo));
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      filters.push(or(like(orders.reference, term), like(orders.invoiceNumber, term), like(customers.company, term))!);
    }
    const where = and(...filters);

    const items: Order[] = await this.db
      .select(orderColumns)
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(where)
      .orderBy(desc(orders.issueDate), desc(orders.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(where);

    return { items, total, page, pageSize };
  }

  async findByReference(reference: string) {
    const [order] = await this.db
      .select(orderColumns)
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(this.inWorkspace(eq(orders.reference, reference)));
    if (!order) return null;
    const items = await this.db
      .select({
        id: orderItems.id,
        position: orderItems.position,
        title: orderItems.title,
        description: orderItems.description,
        quantity: orderItems.quantity,
        unit: orderItems.unit,
        unitRateCents: orderItems.unitRateCents,
        taxRateBps: orderItems.taxRateBps,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.position));
    return { ...order, items };
  }

  async findById(id: number) {
    const [row] = await this.db
      .select(orderColumns)
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(this.inWorkspace(eq(orders.id, id)));
    return row ?? null;
  }

  async countByStatus() {
    const rows = await this.db.select({ status: orders.status, n: count() }).from(orders).where(this.inWorkspace()).groupBy(orders.status);
    const result = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
    for (const r of rows) result[r.status] = r.n;
    return result;
  }

  listSummaries() {
    return this.db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        status: orders.status,
        amountCents: orders.amountCents,
        issueDate: orders.issueDate,
        dueDate: orders.dueDate,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .where(this.inWorkspace());
  }

  async latestReference() {
    const [row] = await this.db.select({ reference: orders.reference }).from(orders).where(this.inWorkspace()).orderBy(desc(orders.id)).limit(1);
    return row?.reference ?? null;
  }

  async create({ items, ...order }: NewOrder, now: Date) {
    const [owner] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, order.customerId), eq(customers.workspaceId, this.workspaceId)));
    if (!owner) throw new NotFoundError("Customer", order.customerId);
    const id = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({ ...order, workspaceId: this.workspaceId, createdAt: now, updatedAt: now })
        .returning({ id: orders.id });
      if (items.length) {
        await tx.insert(orderItems).values(items.map((item, position) => ({ ...item, orderId: created!.id, position })));
      }
      return created!.id;
    });
    const [row] = await this.db
      .select(orderColumns)
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(this.inWorkspace(eq(orders.id, id)));
    return row!;
  }

  async updateStatus(id: number, change: OrderStatusChange) {
    await this.db.update(orders).set(change).where(this.inWorkspace(eq(orders.id, id)));
  }

  async update(id: number, { items, ...fields }: OrderUpdate) {
    const [owner] = await this.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, fields.customerId), eq(customers.workspaceId, this.workspaceId)));
    if (!owner) throw new NotFoundError("Customer", fields.customerId);
    await this.db.transaction(async (tx) => {
      const updated = await tx.update(orders).set(fields).where(this.inWorkspace(eq(orders.id, id))).returning({ id: orders.id });
      if (updated.length === 0) throw new NotFoundError("Order", id);
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      if (items.length) await tx.insert(orderItems).values(items.map((item, position) => ({ ...item, orderId: id, position })));
    });
  }

  async delete(id: number) {
    // The payments check runs in the DELETE itself, so a payment recorded after the caller's check is never erased.
    const deleted = await this.db
      .delete(orders)
      .where(this.inWorkspace(eq(orders.id, id), notExists(this.db.select({ id: payments.id }).from(payments).where(eq(payments.orderId, orders.id)))))
      .returning({ id: orders.id });
    return deleted.length > 0;
  }
}
