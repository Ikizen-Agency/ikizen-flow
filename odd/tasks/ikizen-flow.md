# Feature: Ikizen Flow — fullstack Next.js business platform

Locator: `odd/tasks/ikizen-flow.md` · Engram mirror: `odd/ikizen-flow/tasks` · Branch: `feat/ikizen-flow`

## Objective
Build a fullstack Next.js app (frontend + backend in Next) implementing the Stitch "Ikizen Flow" UI/UX design.

## Problem / Why
The user has a Stitch design export (`design/stitch_ikizen_flow_business_platform/`) with 4 screens and a design system (`ikizen_flow/DESIGN.md`) and wants it turned into a real, working product.

## Scope
- Screens: Overview dashboard, Customers directory, Sales orders management, Tasks kanban.
- Backend: persistent data, server-side reads, mutations (create/update) via Server Actions + Route Handlers.
- Out of scope (for now): authentication, multi-tenant workspaces, Invoices/Reports/Settings pages (nav items render, pages are placeholders).

## Constraints / Decisions
- Next.js (App Router, latest stable) + TypeScript strict + Tailwind CSS v4, pnpm.
- DB: SQLite via Drizzle ORM (libsql driver) — zero infra, swappable to Postgres/Turso later.
- Validation: Zod at the boundary (actions / route handlers).
- Architecture: screaming + hexagonal-lite: `src/modules/<feature>/{domain,application,infrastructure,ui}`; `src/app` routes stay thin (containers), UI components are presentational.
- Design tokens from DESIGN.md mapped to Tailwind theme; Inter font via `next/font`; icons via Material Symbols (as in the design).
- Tests: Vitest for domain/application logic (test-first where deterministic).
- Artifacts (code, UI copy, docs) in English.

## Tasks
- [x] T1 — Scaffold Next.js + Tailwind design tokens + app shell (sidebar, topbar, responsive) + Vitest. Route: delegated (writer, 2+ non-trivial files).
- [x] T2 — Data layer: Drizzle schema (customers, orders, tasks, activity), migrations, seed with design data, repositories. Route: delegated.
- [x] T3 — Customers directory: list/search/filter + create customer (Server Action). Route: delegated.
- [ ] T4 — Sales orders management: list/filters/totals + create order + status change. Route: delegated.
- [ ] T5 — Tasks kanban: columns by status, create task, move task between statuses. Route: delegated.
- [ ] T6 — Overview dashboard: KPIs, revenue trend chart, revenue by category, critical tasks, recent sales, activity, overdue receivables — all from DB aggregates. Route: delegated.
- [ ] T7 — README + final checks (lint, typecheck, test, build).

## Acceptance criteria
- `pnpm dev` runs; all 4 screens match the design visually and read from the DB.
- Mutations persist and revalidate the UI.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.

## Delivery
Strategy: `ask-on-risk`. Forecast: well over 400 authored lines (greenfield) — chain strategy to be asked before PRs; local work-unit commits per task.

## Progress / Evidence
- T1 (delegated writer): Next.js 16.4.1 (App Router, Turbopack, `cacheComponents` + `partialPrefetching` on by template default), Tailwind v4 tokens in `src/app/globals.css`, shell in `src/shared/shell/`, UI primitives in `src/shared/ui/`, placeholder routes under `src/app/(workspace)/`. Verified: `pnpm install` ok; `pnpm typecheck` ok; `pnpm lint` 0 problems; `pnpm test` pass; `pnpm build` ok (8 static routes); `next start` smoke: /customers renders with active nav, /invoices 200. Commit: `28fee5e`.

- T2 (delegated writer): Drizzle ORM 0.45 + @libsql/client, schema `src/server/db/schema.ts` (members, customers, orders, order_items, tasks, task_subtasks, activity_events), migration `drizzle/0000_*.sql`, deterministic relative-date seed (14 customers, 47 orders ending at SL-1048, 13 tasks, 8 activity events). Modules `src/modules/{customers,sales,tasks,activity,team}/{domain,application,infrastructure}`, composition root `src/server/container.ts`. Domain tests (money, time, order transitions/overdue/totals, task due state/moves, customer rules) were written before the implementation, but RED was not observed: dependencies were still installing when the implementation was written. Data-layer integration test runs against a temp SQLite file. Verified: `pnpm db:reset` ok; `pnpm typecheck` ok; `pnpm lint` 0 problems; `pnpm test` 8 files / 46 tests pass; `pnpm build` ok. Commit: `9f49ad1`.

- Review T1/T2 (base 28fee5e): assessed medium (slice_budget_reached); consent declined by user for this candidate. Reviewed boundary advances to 9f49ad1.

- T3 (delegated writer): `/customers` reproduces the Stitch directory: header with total/quarter badges, Active Pipeline + Client Health KPI tiles, Add Customer / Export CSV / Bulk Actions bar, URL-driven search (debounced) + status/tier/sort filters with reset, server-side paginated table (6/page, `1 2 3 ... N` pagination), row checkboxes, `?customer=<id>` slide-over (lifetime value, open deals, derived health score, contact, recent orders as interaction log, account & billing), `?create=1` Add New Customer modal (Server Action + Zod, field errors, duplicate-name guard, optional initial engagement saved as a draft order, redirects to the new profile). `GET /customers/export` streams the filtered directory as CSV (formula-injection safe). New shared primitives: `Overlay` (Level 3 + scrim, Escape/scrim close via URL), `Pagination`, `hrefWith`. Deliberately non-functional: Bulk Actions items, row Edit and More (rendered disabled, "coming soon"); design's HQ location replaced by Account & Billing (no location in schema); "Open Full Profile" became "View Sales Orders". RED observed before implementation (9 test files / 10 tests failing: missing modules + case-insensitive duplicate check), then GREEN. Verified: `pnpm typecheck` ok; `pnpm lint` 0 problems; `pnpm test` 16 files / 77 tests pass; `pnpm build` ok (`/customers` partial prerender, `/customers/export` dynamic); `next start` smoke: /customers, ?create=1, ?status=inactive, ?customer=1, ?page=2 → 200 with seed names; export CSV 200.

## Next step
T4 (sales orders management).
