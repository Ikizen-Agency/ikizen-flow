/**
 * Drizzle schema (SQLite / libSQL).
 * Conventions: money is integer cents, timestamps are `timestamp_ms` integers, enums are text unions.
 * Enum value lists live in each module's domain layer and are the single source of truth.
 */
import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { ACTIVITY_CATEGORIES } from "../../modules/activity/domain/activity";
import { CUSTOMER_STATUSES, CUSTOMER_TIERS } from "../../modules/customers/domain/customer";
import { ORDER_CATEGORIES, ORDER_STATUSES, PAYMENT_TERMS } from "../../modules/sales/domain/order";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../modules/tasks/domain/task";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  createdAt: createdAt(),
});

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    company: text("company").notNull(),
    tier: text("tier", { enum: CUSTOMER_TIERS }).notNull(),
    status: text("status", { enum: CUSTOMER_STATUSES }).notNull().default("active"),
    industry: text("industry").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    billingEmail: text("billing_email"),
    paymentTerms: text("payment_terms", { enum: PAYMENT_TERMS }).notNull().default("net_30"),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("customers_status_idx").on(t.status),
    index("customers_tier_idx").on(t.tier),
    uniqueIndex("customers_company_unique").on(t.company),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reference: text("reference").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category", { enum: ORDER_CATEGORIES }).notNull(),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("draft"),
    paymentTerms: text("payment_terms", { enum: PAYMENT_TERMS }).notNull().default("net_30"),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    invoiceNumber: text("invoice_number").unique(),
    issueDate: integer("issue_date", { mode: "timestamp_ms" }).notNull(),
    dueDate: integer("due_date", { mode: "timestamp_ms" }).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
    index("orders_issue_date_idx").on(t.issueDate),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull().default(1),
    unit: text("unit", { enum: ["unit", "hours"] }).notNull().default("unit"),
    unitRateCents: integer("unit_rate_cents").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    priority: text("priority", { enum: TASK_PRIORITIES }).notNull().default("medium"),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    assigneeId: integer("assignee_id").references(() => members.id, { onDelete: "set null" }),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    estimateHours: integer("estimate_hours"),
    trackedHours: integer("tracked_hours").notNull().default(0),
    blockedReason: text("blocked_reason"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    commentCount: integer("comment_count").notNull().default(0),
    position: integer("position").notNull().default(0),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_status_idx").on(t.status),
    index("tasks_assignee_idx").on(t.assigneeId),
    index("tasks_customer_idx").on(t.customerId),
  ],
);

export const taskSubtasks = sqliteTable(
  "task_subtasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("task_subtasks_task_idx").on(t.taskId)],
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => members.id, { onDelete: "set null" }),
    /** Sentence predicate, rendered after the actor name: "marked Invoice #INV-2041 as Paid". */
    message: text("message").notNull(),
    category: text("category", { enum: ACTIVITY_CATEGORIES }).notNull(),
    entityType: text("entity_type", { enum: ["customer", "order", "task"] }),
    entityId: integer("entity_id"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  tasks: many(tasks),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  customer: one(customers, { fields: [tasks.customerId], references: [customers.id] }),
  assignee: one(members, { fields: [tasks.assigneeId], references: [members.id] }),
  subtasks: many(taskSubtasks),
}));

export const taskSubtasksRelations = relations(taskSubtasks, ({ one }) => ({
  task: one(tasks, { fields: [taskSubtasks.taskId], references: [tasks.id] }),
}));

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  actor: one(members, { fields: [activityEvents.actorId], references: [members.id] }),
}));
