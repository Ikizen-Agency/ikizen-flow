import "server-only";
import { and, asc, count, desc, eq, gte, like, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { customers, orders } from "@/server/db/schema";
import { CUSTOMER_STATUSES, type CustomerStatus } from "../domain/customer";
import type { Customer, CustomerListItem, CustomerListQuery, CustomerRepository, NewCustomer } from "../application/ports";

const totalSales = sql<number>`coalesce(sum(case when ${orders.status} not in ('draft','cancelled') then ${orders.amountCents} else 0 end), 0)`;
const outstanding = sql<number>`coalesce(sum(case when ${orders.status} in ('pending','processing','invoiced') then ${orders.amountCents} else 0 end), 0)`;

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    company: row.company,
    tier: row.tier,
    status: row.status,
    industry: row.industry,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    billingEmail: row.billingEmail,
    paymentTerms: row.paymentTerms,
    lastActivityAt: row.lastActivityAt,
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

export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(private readonly db: Database) {}

  async list({ search, status, tier, sort = "last_active", page = 1, pageSize = 10 }: CustomerListQuery) {
    const filters: SQL[] = [];
    if (status) filters.push(eq(customers.status, status));
    if (tier) filters.push(eq(customers.tier, tier));
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      filters.push(or(like(customers.company, term), like(customers.contactName, term), like(customers.contactEmail, term))!);
    }
    const where = filters.length ? and(...filters) : undefined;

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
    const row = await this.db.query.customers.findFirst({ where: eq(customers.id, id) });
    return row ? toCustomer(row) : null;
  }

  async findSummaryById(id: number) {
    const [row] = await this.db
      .select(summaryColumns)
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(eq(customers.id, id))
      .groupBy(customers.id);
    return row ? toListItem(row) : null;
  }

  async findByCompany(company: string) {
    const [row] = await this.db
      .select()
      .from(customers)
      .where(sql`lower(${customers.company}) = lower(${company.trim()})`)
      .limit(1);
    return row ? toCustomer(row) : null;
  }

  async countCreatedSince(since: Date) {
    const [{ total }] = await this.db.select({ total: count() }).from(customers).where(gte(customers.createdAt, since));
    return total;
  }

  listOptions() {
    return this.db
      .select({ id: customers.id, company: customers.company, contactEmail: customers.contactEmail })
      .from(customers)
      .where(sql`${customers.status} != 'archived'`)
      .orderBy(asc(customers.company));
  }

  async countByStatus() {
    const rows = await this.db.select({ status: customers.status, n: count() }).from(customers).groupBy(customers.status);
    const result = Object.fromEntries(CUSTOMER_STATUSES.map((s) => [s, 0])) as Record<CustomerStatus, number>;
    for (const r of rows) result[r.status] = r.n;
    return result;
  }

  async create(input: NewCustomer, now: Date) {
    const [row] = await this.db
      .insert(customers)
      .values({ ...input, lastActivityAt: now, createdAt: now, updatedAt: now })
      .returning();
    return toCustomer(row!);
  }

  async touch(id: number, at: Date) {
    await this.db.update(customers).set({ lastActivityAt: at, updatedAt: at }).where(eq(customers.id, id));
  }
}
