import "server-only";
import { and, asc, count, desc, eq, gte, like, lte, or, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, orderItems, orders } from "@/server/db/schema";
import { ORDER_STATUSES, type OrderStatus } from "../domain/order";
import type { NewOrder, Order, OrderListQuery, OrderRepository, OrderStatusChange } from "../application/ports";

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
};

export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  async list({ status, customerId, search, issuedFrom, issuedTo, page = 1, pageSize = 20 }: OrderListQuery) {
    const filters: SQL[] = [];
    if (status) filters.push(eq(orders.status, status));
    if (customerId) filters.push(eq(orders.customerId, customerId));
    if (issuedFrom) filters.push(gte(orders.issueDate, issuedFrom));
    if (issuedTo) filters.push(lte(orders.issueDate, issuedTo));
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      filters.push(or(like(orders.reference, term), like(orders.invoiceNumber, term), like(customers.company, term))!);
    }
    const where = filters.length ? and(...filters) : undefined;

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
      .where(eq(orders.reference, reference));
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

  async countByStatus() {
    const rows = await this.db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status);
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
      .from(orders);
  }

  async latestReference() {
    const [row] = await this.db.select({ reference: orders.reference }).from(orders).orderBy(desc(orders.id)).limit(1);
    return row?.reference ?? null;
  }

  async create({ items, ...order }: NewOrder, now: Date) {
    const id = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({ ...order, createdAt: now, updatedAt: now })
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
      .where(eq(orders.id, id));
    return row!;
  }

  async updateStatus(id: number, change: OrderStatusChange) {
    await this.db.update(orders).set(change).where(eq(orders.id, id));
  }
}
