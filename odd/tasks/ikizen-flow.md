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
- [ ] T2 — Data layer: Drizzle schema (customers, orders, tasks, activity), migrations, seed with design data, repositories. Route: delegated.
- [ ] T3 — Customers directory: list/search/filter + create customer (Server Action). Route: delegated.
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
- T1 (delegated writer): Next.js 16.4.1 (App Router, Turbopack, `cacheComponents` + `partialPrefetching` on by template default), Tailwind v4 tokens in `src/app/globals.css`, shell in `src/shared/shell/`, UI primitives in `src/shared/ui/`, placeholder routes under `src/app/(workspace)/`. Verified: `pnpm install` ok; `pnpm typecheck` ok; `pnpm lint` 0 problems; `pnpm test` pass; `pnpm build` ok (8 static routes); `next start` smoke: /customers renders with active nav, /invoices 200. Commit: (this commit).

## Next step
T2.
