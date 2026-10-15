# Ikizen Flow

Fullstack business operations platform built with Next.js, implementing the Stitch "Ikizen Flow" design (`design/stitch_ikizen_flow_business_platform/`).

## Features

| Route | Screen | Backend |
| --- | --- | --- |
| `/` | Overview dashboard: KPIs, revenue trend, revenue by category, critical tasks, recent sales, team activity, overdue receivables | DB aggregates, complete task / send reminder actions |
| `/customers` | Customers directory: search, filters, pagination, detail panel, create customer | Server Actions, `GET /customers/export` (CSV) |
| `/sales` | Sales orders: KPIs, status tabs, create order with line items, status transitions | Server Actions, `GET /api/orders` (JSON / CSV) |
| `/tasks` | Tasks kanban: filters, drag and drop, list view, task detail, create task | Server Actions with optimistic updates |

Invoices, Reports and Settings are placeholders. There is no authentication yet: all mutations act as the seeded user "Alex Vance".

## Stack

- Next.js 16 (App Router, Cache Components, Server Actions, Route Handlers), React, TypeScript strict
- Tailwind CSS v4 with design tokens from `DESIGN.md` (`src/app/globals.css`)
- SQLite via Drizzle ORM + libSQL, Zod validation
- Vitest

## Getting started

```bash
pnpm install
cp .env.example .env.local   # optional, DATABASE_URL defaults to file:./data/ikizen.db
pnpm db:reset                # migrate + seed
pnpm dev
```

Open http://localhost:3000.

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
  modules/<feature>/         # customers, sales, tasks, dashboard, activity, team
    domain/                  # types and pure business rules (tested)
    application/             # ports (repository interfaces) and use cases
    infrastructure/          # Drizzle repositories implementing the ports
    ui/                      # Server Actions and presentational components
  server/
    container.ts             # composition root wiring repositories into use cases
    db/                      # schema, client, seed
  shared/
    ui/                      # design-system primitives (Button, Badge, Card, ...)
    shell/                   # sidebar, topbar, mobile navigation
    domain/                  # money (integer cents) and time helpers
```

Conventions:

- Only `src/server/container.ts` imports the database client; pages and actions call `container`.
- Money is stored as integer cents. "Overdue" is derived from due dates, never stored.
- With Cache Components enabled, request-time data (DB reads, `searchParams`, `new Date()`) lives in async children wrapped in `<Suspense>` after `await connection()`.
