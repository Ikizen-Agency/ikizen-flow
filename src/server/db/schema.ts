/**
 * Drizzle schema (SQLite / libSQL).
 * Conventions: money is integer cents, timestamps are `timestamp_ms` integers, enums are text unions.
 * Enum value lists live in each module's domain layer and are the single source of truth.
 */
import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { ACTIVITY_CATEGORIES } from "../../modules/activity/domain/activity";
import { CUSTOMER_STATUSES, CUSTOMER_TIERS } from "../../modules/customers/domain/customer";
import { EMAIL_ENTITY_TYPES, EMAIL_KINDS, EMAIL_STATUSES } from "../../modules/mail/domain/email";
import { NOTIFICATION_TYPES } from "../../modules/notifications/domain/notification";
import { ORDER_CATEGORIES, ORDER_STATUSES, PAYMENT_TERMS } from "../../modules/sales/domain/order";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../modules/tasks/domain/task";
import { WORKSPACE_ROLES } from "../../modules/workspaces/domain/workspace";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

// ---------------------------------------------------------------------------
// Better Auth tables (user, session, account, verification). Ids are text, owned by Better Auth.
// ---------------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    /** Password hash for the "credential" provider (email + password). */
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Tenancy: every business row belongs to exactly one workspace.
// ---------------------------------------------------------------------------

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline").notNull().default(""),
  createdAt: createdAt(),
});

const workspaceId = () =>
  integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/** People of a workspace. A member may have a login (`userId`) or not (e.g. teammates tracked without an account). */
export const members = sqliteTable(
  "members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: workspaceId(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** Job title shown in the shell ("Operations Manager"). Access level lives in `workspace_memberships`. */
    role: text("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("members_workspace_email_unique").on(t.workspaceId, t.email), index("members_user_idx").on(t.userId)],
);

/** Which users can open which workspace, with their access level and member profile there. */
export const workspaceMemberships = sqliteTable(
  "workspace_memberships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: workspaceId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: text("role", { enum: WORKSPACE_ROLES }).notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_workspace_user_unique").on(t.workspaceId, t.userId), index("memberships_user_idx").on(t.userId)],
);

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: workspaceId(),
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
    index("customers_workspace_idx").on(t.workspaceId),
    index("customers_status_idx").on(t.status),
    index("customers_tier_idx").on(t.tier),
    uniqueIndex("customers_workspace_company_unique").on(t.workspaceId, t.company),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: workspaceId(),
    reference: text("reference").notNull(),
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
    invoiceNumber: text("invoice_number"),
    issueDate: integer("issue_date", { mode: "timestamp_ms" }).notNull(),
    dueDate: integer("due_date", { mode: "timestamp_ms" }).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_workspace_reference_unique").on(t.workspaceId, t.reference),
    uniqueIndex("orders_workspace_invoice_unique").on(t.workspaceId, t.invoiceNumber),
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
    workspaceId: workspaceId(),
    code: text("code").notNull(),
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
    uniqueIndex("tasks_workspace_code_unique").on(t.workspaceId, t.code),
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
    workspaceId: workspaceId(),
    actorId: integer("actor_id").references(() => members.id, { onDelete: "set null" }),
    /** Sentence predicate, rendered after the actor name: "marked Invoice #INV-2041 as Paid". */
    message: text("message").notNull(),
    category: text("category", { enum: ACTIVITY_CATEGORIES }).notNull(),
    entityType: text("entity_type", { enum: ["customer", "order", "task"] }),
    entityId: integer("entity_id"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_workspace_created_idx").on(t.workspaceId, t.createdAt)],
);

/** Every email the app sends (or would send without SMTP), per workspace. */
export const emailOutbox = sqliteTable(
  "email_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: workspaceId(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body"),
    kind: text("kind", { enum: EMAIL_KINDS }).notNull(),
    status: text("status", { enum: EMAIL_STATUSES }).notNull().default("queued"),
    error: text("error"),
    relatedEntityType: text("related_entity_type", { enum: EMAIL_ENTITY_TYPES }),
    relatedEntityId: integer("related_entity_id"),
    createdById: integer("created_by_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("email_outbox_workspace_created_idx").on(t.workspaceId, t.createdAt), index("email_outbox_status_idx").on(t.status)],
);

/** In-app notifications for one member of a workspace. */
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: workspaceId(),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_recipient_idx").on(t.workspaceId, t.recipientId, t.readAt, t.createdAt)],
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

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(members),
  memberships: many(workspaceMemberships),
}));

export const membersRelations = relations(members, ({ one }) => ({
  workspace: one(workspaces, { fields: [members.workspaceId], references: [workspaces.id] }),
  user: one(user, { fields: [members.userId], references: [user.id] }),
}));

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMemberships.workspaceId], references: [workspaces.id] }),
  user: one(user, { fields: [workspaceMemberships.userId], references: [user.id] }),
  member: one(members, { fields: [workspaceMemberships.memberId], references: [members.id] }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(workspaceMemberships),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
