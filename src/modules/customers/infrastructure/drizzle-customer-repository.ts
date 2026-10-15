import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, notExists, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, orders, tasks } from "@/server/db/schema";
import { CUSTOMER_STATUSES, effectiveCustomerStatus, type CustomerDependencies, type CustomerStatus, type CustomerTier } from "../domain/customer";
import type { Customer, CustomerListItem, CustomerListQuery, CustomerPatch, CustomerRepository, NewCustomer } from "../application/ports";

const totalSales = sql<number>`coalesce(sum(case when ${orders.status} not in ('draft','cancelled') then ${orders.amountCents} else 0 end), 0)`;
const outstanding = sql<number>`coalesce(sum(case when ${orders.status} in ('pending','processing','invoiced') then ${orders.amountCents} else 0 end), 0)`;

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    company: row.company,
    tier: row.tier,
    status: effectiveCustomerStatus(row),
    baseStatus: row.status,
    industry: row.industry,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    billingEmail: row.billingEmail,
    paymentTerms: row.paymentTerms,
    lastActivityAt: row.lastActivityAt,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
  };
}

const summaryColumns = { customer: customers, totalSalesCents: totalSales, outstandingCents: outstanding };

function toListItem(row: { customer: typeof customers.$inferSelect; totalSalesCents: number; outstandingCents: number }): CustomerListItem {
  return {
    ...toCustomer(row.customer),
    totalSalesCents: Number(row.totalSalesCents),
    outstandingCents: Number(row.outstandingCents),
  };
}

/** Customers of one workspace: every query is filtered by `workspaceId`. */
export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private inWorkspace(...filters: Array<SQL | undefined>) {
    return and(eq(customers.workspaceId, this.workspaceId), ...filters);
  }

  async list({ search, status, tier, sort = "last_active", page = 1, pageSize = 10 }: CustomerListQuery) {
    const filters: SQL[] = [eq(customers.workspaceId, this.workspaceId)];
    // Archived accounts only show up under the "archived" filter.
    if (status === "archived") filters.push(isNotNull(customers.archivedAt));
    else {
      filters.push(isNull(customers.archivedAt));
      if (status) filters.push(eq(customers.status, status));
    }
    if (tier) filters.push(eq(customers.tier, tier));
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      filters.push(or(like(customers.company, term), like(customers.contactName, term), like(customers.contactEmail, term))!);
    }
    const where = and(...filters);

    const orderBy =
      sort === "sales_desc"
        ? [desc(totalSales)]
        : sort === "sales_asc"
          ? [asc(totalSales)]
          : sort === "company"
            ? [asc(customers.company)]
            : [sql`${customers.lastActivityAt} desc nulls last`];

    const rows = await this.db
      .select(summaryColumns)
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(where)
      .groupBy(customers.id)
      .orderBy(...orderBy, asc(customers.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await this.db.select({ total: count() }).from(customers).where(where);

    return {
      items: rows.map(toListItem),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: number) {
    const row = await this.db.query.customers.findFirst({ where: this.inWorkspace(eq(customers.id, id)) });
    return row ? toCustomer(row) : null;
  }

  async findSummaryById(id: number) {
    const [row] = await this.db
      .select(summaryColumns)
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(this.inWorkspace(eq(customers.id, id)))
      .groupBy(customers.id);
    return row ? toListItem(row) : null;
  }

  async findByCompany(company: string) {
    const [row] = await this.db
      .select()
      .from(customers)
      .where(this.inWorkspace(sql`lower(${customers.company}) = lower(${company.trim()})`))
      .limit(1);
    return row ? toCustomer(row) : null;
  }

  async countCreatedSince(since: Date) {
    const [{ total }] = await this.db.select({ total: count() }).from(customers).where(this.inWorkspace(gte(customers.createdAt, since)));
    return total;
  }

  listOptions() {
    return this.db
      .select({ id: customers.id, company: customers.company, contactEmail: customers.contactEmail })
      .from(customers)
      .where(this.inWorkspace(isNull(customers.archivedAt)))
      .orderBy(asc(customers.company));
  }

  async countByStatus() {
    const displayStatus = sql<CustomerStatus>`case when ${customers.archivedAt} is not null then 'archived' else ${customers.status} end`;
    const rows = await this.db.select({ status: displayStatus, n: count() }).from(customers).where(this.inWorkspace()).groupBy(displayStatus);
    const result = Object.fromEntries(CUSTOMER_STATUSES.map((s) => [s, 0])) as Record<CustomerStatus, number>;
    for (const r of rows) result[r.status] = r.n;
    return result;
  }

  async create(input: NewCustomer, now: Date) {
    const [row] = await this.db
      .insert(customers)
      .values({ ...input, workspaceId: this.workspaceId, lastActivityAt: now, createdAt: now, updatedAt: now })
      .returning();
    return toCustomer(row!);
  }

  async touch(id: number, at: Date) {
    await this.db.update(customers).set({ lastActivityAt: at, updatedAt: at }).where(this.inWorkspace(eq(customers.id, id)));
  }

  async findManyByIds(ids: ReadonlyArray<number>) {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(customers).where(this.inWorkspace(inArray(customers.id, [...ids]))).orderBy(asc(customers.company));
    return rows.map(toCustomer);
  }

  async update(id: number, patch: CustomerPatch, now: Date) {
    const [row] = await this.db
      .update(customers)
      .set({ ...patch, updatedAt: now })
      .where(this.inWorkspace(eq(customers.id, id)))
      .returning();
    return row ? toCustomer(row) : null;
  }

  async setArchived(ids: ReadonlyArray<number>, archivedAt: Date | null, now: Date) {
    if (ids.length === 0) return [];
    const rows = await this.db
      .update(customers)
      .set({ archivedAt, updatedAt: now })
      .where(this.inWorkspace(inArray(customers.id, [...ids]), archivedAt ? isNull(customers.archivedAt) : isNotNull(customers.archivedAt)))
      .returning({ id: customers.id });
    return rows.map((r) => r.id);
  }

  async setTier(ids: ReadonlyArray<number>, tier: CustomerTier, now: Date) {
    if (ids.length === 0) return [];
    const rows = await this.db
      .update(customers)
      .set({ tier, updatedAt: now })
      .where(this.inWorkspace(inArray(customers.id, [...ids])))
      .returning({ id: customers.id });
    return rows.map((r) => r.id);
  }

  async dependencies(ids: ReadonlyArray<number>) {
    const result = new Map<number, CustomerDependencies>();
    if (ids.length === 0) return result;
    const owned = this.inWorkspace(inArray(customers.id, [...ids]));
    const [orderRows, taskRows] = await Promise.all([
      this.db
        .select({ id: customers.id, n: count(orders.id) })
        .from(customers)
        .leftJoin(orders, eq(orders.customerId, customers.id))
        .where(owned)
        .groupBy(customers.id),
      this.db
        .select({ id: customers.id, n: count(tasks.id) })
        .from(customers)
        .leftJoin(tasks, eq(tasks.customerId, customers.id))
        .where(owned)
        .groupBy(customers.id),
    ]);
    for (const r of orderRows) result.set(r.id, { orders: r.n, tasks: 0 });
    for (const r of taskRows) result.set(r.id, { orders: result.get(r.id)?.orders ?? 0, tasks: r.n });
    return result;
  }

  async deleteMany(ids: ReadonlyArray<number>) {
    if (ids.length === 0) return [];
    // One DELETE statement re-checks dependencies at write time, so history linked after a caller's check is never lost.
    const rows = await this.db
      .delete(customers)
      .where(
        this.inWorkspace(
          inArray(customers.id, [...ids]),
          notExists(this.db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customers.id))),
          notExists(this.db.select({ id: tasks.id }).from(tasks).where(eq(tasks.customerId, customers.id))),
        ),
      )
      .returning({ id: customers.id });
    return rows.map((r) => r.id);
  }
}
