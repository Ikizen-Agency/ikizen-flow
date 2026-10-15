# Ikizen Flow

Fullstack business operations platform built with Next.js, implementing the Stitch "Ikizen Flow" design (`design/stitch_ikizen_flow_business_platform/`).

## Features

| Route | Screen | Backend |
| --- | --- | --- |
| `/` | Overview dashboard: KPIs, revenue trend, revenue by category, critical tasks, recent sales, team activity, overdue receivables | DB aggregates, complete task / send reminder actions |
| `/customers` | Customers directory: search, filters, pagination, detail panel, create / edit customer, status and tier changes, archive / unarchive (`?status=archived`), delete (only without orders or tasks), row "More actions" menu, bulk actions on selected rows (Send Campaign email, Apply Tier Tag, Archive, Delete) | Server Actions, `GET /customers/export` (CSV) |
| `/sales` | Sales orders: KPIs, status tabs, create order with line items, status transitions, edit drafts / pending orders in the composer (`?edit=SL-xxxx`), delete unpaid drafts / cancelled orders, payments (partial payments up to the balance, history, delete; fully paid orders complete automatically), paid / balance indicator in the register | Server Actions, `GET /api/orders` (JSON / CSV, with `paidCents` / `balanceCents`) |
| `/tasks` | Tasks kanban: server-side text search (`?q=`, title / code / description) with assignee, priority, client and due filters, drag and drop (moving to Blocked asks for a required reason), list view, task detail, create / edit (`?edit=<id>`, reassignment notifies the new assignee) / duplicate / delete tasks, editable blocked reason, checklist (toggle, add, rename, delete), comments (edit / delete your own) with `@` member autocomplete; mentions notify the mentioned teammates, attachments (upload, download, delete), time tracking ("Log time", entries, tracked vs estimate) | Server Actions with optimistic updates, `GET /api/attachments/<id>` (download) |
| `/invoices` | Invoices: KPI tiles (outstanding, overdue, collected this month, average days to pay), All / Open / Overdue / Paid tabs, search (invoice #, order, client), client and issue-date filters, pagination, row actions; `/invoices/<number>` printable invoice (workspace as issuer, bill-to, line items, totals, payments, balance, terms) with Print / Save as PDF, Send invoice, Send reminder (unpaid only), Mark as paid and Record payment; Issue an Invoice from pending / processing orders | Server Actions (outbox emails, sales payment lifecycle), `GET /invoices/export` (CSV of the filtered list) |
| `/reports` | Reports for a date range (presets: this month, last month, this quarter, year to date, last 12 months, or custom from / to): revenue over time (billed vs collected chart + table), revenue by category, top customers, sales pipeline by status, accounts receivable aging (current, 1-30, 31-60, 61-90, 90+ days), task throughput (created vs completed per week, by assignee, cycle time, overdue), team time logged | `GET /reports/export?section=<revenue\|categories\|customers\|pipeline\|aging\|tasks\|assignees\|time>&preset=…` (CSV per section) |
| `/help` | Help Center: getting started, keyboard shortcuts, module guides, FAQ, contact support form | Server Action emails `SUPPORT_EMAIL` through the outbox |
| Shell | ⌘K / Ctrl+K command palette (customers, orders, tasks, quick actions, navigation), notifications bell (unread first, mark read / all read), per-route breadcrumb, account menu, workspace switcher + create workspace | `GET /api/search?q=` (JSON, grouped, workspace-scoped), Server Actions |
| `/login`, `/register` | Email + password sign-in; registration creates a new workspace owned by the new user | Better Auth (`/api/auth/*`) |

Settings is a placeholder. Every screen, Server Action and Route Handler requires a session, and all business data is scoped to the active workspace.

## Stack

- Next.js 16 (App Router, Cache Components, Server Actions, Route Handlers), React, TypeScript strict
- Tailwind CSS v4 with design tokens from `DESIGN.md` (`src/app/globals.css`)
- SQLite via Drizzle ORM + libSQL, Zod validation
- Better Auth (email + password, database sessions, Drizzle adapter)
- Vitest

## Getting started

```bash
pnpm install
cp .env.example .env.local   # optional in development (see Environment)
pnpm db:reset                # migrate + seed
pnpm dev
```

Open http://localhost:3000 and sign in with the demo account (shown on the login page in development):

| Email | Password | Workspaces |
| --- | --- | --- |
| `alex@northstar.studio` | `ikizen-demo-123` | Northstar Studio (owner, full design dataset), Helix Labs Sandbox (owner, small dataset) |

Switch or create workspaces from the workspace card at the top of the sidebar. The seed adds a few notifications for Alex (two unread) and two outbox entries. Upgrading a database created before workspaces existed requires `pnpm db:reset` (the migration adds required `workspace_id` columns).

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `file:./data/ikizen.db` | libSQL URL |
| `BETTER_AUTH_SECRET` | development-only secret | Required in production (`next start`): at least 32 characters, e.g. `openssl rand -base64 32`. The server refuses to start without it. |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Public origin of the app (set it when serving on another host or port). |
| `SMTP_HOST` | unset | When set, emails are delivered through SMTP (nodemailer). Unset: emails are only recorded in the outbox with status `logged`. |
| `SMTP_PORT` / `SMTP_SECURE` | `587` / `true` only on port 465 | SMTP port and implicit TLS. |
| `SMTP_USER` / `SMTP_PASS` | unset | SMTP credentials (optional). |
| `SMTP_FROM` | `Ikizen Flow <no-reply@ikizen.local>` | Sender address. |
| `SUPPORT_EMAIL` | `support@ikizen.local` | Recipient of the Help page contact form. |
| `UPLOADS_DIR` | `data/uploads` | Directory for task attachment files (absolute, or relative to the app's working directory). Files live under `<UPLOADS_DIR>/<workspaceId>/<uuid>`; the default location is gitignored. `pnpm db:reset` / `db:seed` delete the workspace folders in it before seeding. |

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js lifecycle |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` / `test:watch` | Vitest |
| `pnpm db:generate` | Generate Drizzle migrations from the schema |
| `pnpm db:migrate` / `db:seed` / `db:reset` | Apply migrations, seed demo data, or both from scratch |

The seed uses dates relative to "now", so re-run `pnpm db:reset` to refresh due dates and trends.

## Architecture

Screaming, hexagonal-lite structure organized by feature:

```
src/
  app/                       # thin routes (containers): pages, layouts, route handlers
  proxy.ts                   # optimistic auth redirect (Next 16 Proxy, formerly Middleware)
  modules/<feature>/         # auth, workspaces, customers, sales, invoices, reports, tasks, dashboard, activity, team, mail, notifications, search, help
    domain/                  # types and pure business rules (tested)
    application/             # ports (repository interfaces) and use cases
    infrastructure/          # Drizzle repositories implementing the ports
    ui/                      # Server Actions and presentational components
  server/
    auth.ts                  # Better Auth instance (Drizzle adapter, sign-up hook)
    container.ts             # composition root: forWorkspace(id) wires scoped repositories into use cases
    request-context.ts       # session -> { user, workspace, role, member } per request
    db/                      # schema, client, seed
  shared/
    ui/                      # design-system primitives (Button, Badge, Card, ...)
    shell/                   # sidebar, topbar, mobile navigation
    domain/                  # money (integer cents) and time helpers
```

Conventions:

- Only `src/server/container.ts` and `src/server/auth.ts` import the database client.
- Pages, Server Actions and Route Handlers never pick a workspace themselves; they get it from the session (see Authentication and workspaces).
- Money is stored as integer cents. "Overdue" is derived from due dates, never stored.
- With Cache Components enabled, request-time data (DB reads, `searchParams`, `new Date()`) lives in async children wrapped in `<Suspense>` after `await connection()`.

## Authentication and workspaces

- **Better Auth** (`src/server/auth.ts`) handles email + password with database sessions (`user`, `session`, `account`, `verification` tables in the Drizzle schema). Endpoints are mounted at `/api/auth/[...all]`; the `nextCookies` plugin lets Server Actions set the session cookie. `src/modules/auth/ui/auth-client.ts` exports a browser client for client-side session hooks.
- **Workspaces**: `workspaces` + `workspace_memberships` (`owner` / `admin` / `member`). `members` are per-workspace people with an optional `user_id` (teammates without a login are allowed). Customers, orders, tasks, activity events and members carry `workspace_id`; order items and subtasks are reached through their parent. Company names, order references, invoice numbers and task codes are unique per workspace.
- **Registration**: every sign-up (the `/register` form or `POST /api/auth/sign-up/email`) runs a Better Auth `user.create.after` hook that provisions a new workspace (optional `workspaceName` body field) with the user as owner.
- **Request context** (`src/server/request-context.ts`, server-only, memoised per request):
  - `getRequestContext()` returns `{ user, workspace, role, member, memberships }` or `null`. The active workspace comes from the `ikizen_workspace` cookie only when the user is a member of it, otherwise the first workspace.
  - Pages / Server Components: `const { ctx, app } = await getWorkspaceApp("/current-path")` (redirects to `/login?next=...` when signed out). `app` holds the use cases bound to `ctx.workspace.id`; pass `ctx.member.id` as the actor of mutations.
  - Server Actions: `const { ctx, app } = await getWorkspaceApp()` as the first statement.
  - Route Handlers: `const auth = await authorizeRoute(); if (auth instanceof Response) return auth;` (401 JSON when signed out).
  - `switchWorkspaceAction` and `listMyWorkspaces()` (`src/modules/workspaces/ui/`) power the workspace switcher; `signOutAction` ends the session.
- **Email outbox** (`src/modules/mail/`): `app.mail.send({ to, subject, text, html?, kind, relatedEntityType?, relatedEntityId?, createdById? })` stores the email in `email_outbox` (`queued`), delivers it through the configured `Mailer` (SMTP or log) and records `sent`, `logged` or `failed` (with the error). It never throws on delivery failures; check the returned `status`. `app.mail.outbox({ kind?, status?, page? })` lists the workspace outbox.
- **Notifications** (`src/modules/notifications/`): `app.notifications.notify({ recipientIds, actorId, type, title, body?, href? })` creates one notification per recipient, skipping the actor, duplicates and members of other workspaces; `href` must be a relative path. Task, sales and dashboard use cases receive `notify` as an optional dependency and emit on task assignment (create), order status changes, payments recorded and payment reminders (recipient: the order's creator from the activity log).
- **Task comments** (`task_comments`, `src/modules/tasks/domain/comment.ts`): the card counter is derived from the table. Mentions are stored inline as `@[Name](memberId)`; the composer shows `@Name` and serializes picked members on submit. Adding a comment notifies every mentioned member (type `mention`, link `/tasks?task=<id>`); editing notifies only newly added mentions. Only the author can edit or delete a comment. Migration `0005` moves legacy "commented: ..." activity events into the table.
- **Task attachments** (`task_attachments`, `src/modules/tasks/domain/attachment.ts`): uploads go through a Server Action (multipart `FormData` file). Limits: 10 MB per file and an extension allowlist (png, jpg, jpeg, gif, webp, pdf, txt, csv, md, doc(x), xls(x), ppt(x), zip); the stored MIME type is derived from the extension, never from the client, and file names are sanitized (last path segment only, no control or unsafe characters, max 120 characters). Bytes are written by `LocalAttachmentStorage` under random keys that are validated on every read, so stored paths cannot escape `UPLOADS_DIR`. `GET /api/attachments/<id>` (session required, 404 for ids of other workspaces) always answers as a download with `X-Content-Type-Options: nosniff`. Deleting an attachment or its task removes the files. `next.config.ts` raises the Server Action body limit to 11 MB (`experimental.serverActions.bodySizeLimit`; the Next.js default is 1 MB) so 10 MB files plus multipart overhead fit.
- **Time tracking** (`task_time_entries`, `src/modules/tasks/domain/time-entry.ts`): "Log time" records quarter-hour entries (0.25 to 24 hours, optional note) for the signed-in member; a task's tracked hours are the sum of its entries, and members can delete only their own entries.
- **Payments** (`payments` table, `src/modules/sales/domain/payment.ts`): balance = order total - sum(payments). `app.sales.recordPayment(reference, { amountCents, method, paidAt?, reference?, note? }, actorId)` accepts payments on open orders up to the balance; a fully paid processing / invoiced order moves to `completed` with the settling payment's `paidAt`. "Mark as Paid" records the remaining balance as a payment, and deleting a payment of a completed order that is no longer fully paid reopens it as `invoiced`. The balance check, the insert and the automatic completion run in one database transaction in `DrizzlePaymentRepository.record` / `settleBalance`, so concurrent payments can never exceed the total. Orders with any recorded payment are locked: they cannot be edited ("Remove recorded payments before editing this order") or deleted ("Orders with recorded payments cannot be deleted"); the drawer explains why, and the order repository re-checks payments inside the DELETE statement. The `payments.order_id` foreign key keeps `ON DELETE cascade` (changing it to `restrict` would mean a SQLite table rebuild); the domain rule plus the guarded DELETE make that cascade unreachable for paid orders. Migration `0007` backfills one payment (equal to the total, at `paid_at` or the issue date) for completed orders that predate the payments table. The topbar bell lists them (unread first) and marks them read.
- **Invoices** (`src/modules/invoices/`): an invoice is an order in status `invoiced` or `completed` that has an `invoice_number` (assigned by the sales lifecycle when an order is issued). Display status is derived: `completed` = Paid, `invoiced` past its due date = Overdue, otherwise Open. Money is never recomputed here: balances come from `orderBalance`, Record payment / Mark as paid go through `app.sales.recordPayment` / `changeStatus(…, "completed")` (`settleBalance`), and Issue invoice is `changeStatus(…, "invoiced")`. `app.invoices.send` / `sendReminder` email the client's billing (or contact) address through the outbox (kinds `invoice` / `reminder`) with a link built from `BETTER_AUTH_URL`, record an activity event and return the outbox status (`sent`, `logged` or `failed`) shown to the user. When printing, the app shell is hidden (`print:hidden`).
- **Reports** (`src/modules/reports/`): `resolveReportRange` turns `preset` / `from` / `to` URL params into a half-open UTC range (custom ranges are inclusive days, swapped when reversed, capped at five years; unknown values fall back to the last 12 months). `DrizzleReportsRepository` reads workspace-scoped facts and the pure functions in `domain/reports.ts` aggregate them; aging is always as of today.
- **Route protection**: `src/proxy.ts` only checks that a session cookie exists (redirects pages to `/login?next=...`, returns 401 for `/api/*`). It is an optimisation; the real check is the database session lookup in the request context.
