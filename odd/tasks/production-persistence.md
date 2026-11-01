# Production persistence

## Objective

Make https://ikizen-flow.vercel.app fully usable by replacing per-instance `/tmp` state with shared storage.

## Problem

Production runs the ephemeral demo: SQLite and uploads live in `/tmp`, which is private to each function instance. Sessions and data diverge between instances. In Chromium, login and the dashboard work, while `/customers`, `/sales`, `/tasks` and `/invoices` redirect to `/login`. With one cookie, 8 concurrent `get-session` calls returned 6 users and 2 `NULL`, and runtime logs showed 2 separate bootstraps.

## Why

The user chose a shared Turso database on 2026-11-01 and asked for the deployment to be fully usable. This supersedes the ephemeral demo decision for production. Staging keeps the ephemeral demo.

## Scope

- Turso connection with an auth token.
- A guarded, explicit way to migrate and seed a remote database.
- Migrations in the production deployment.
- Shared attachment storage in Vercel Blob.
- Demo credentials visible on the hosted login.
- README deployment documentation.

Out of scope: real email delivery (SMTP stays optional, emails stay `logged`), direct client uploads, periodic demo data reset.

## Constraints

- Secrets never appear in logs or committed files.
- `pnpm db:seed` must not wipe a remote database by accident.
- Staging must never migrate or touch the production database.
- Blobs stay private and are served through the authenticated attachment route.
- Delivery strategy: `single-pr`. Forecast: about 400 authored changed lines.

## Tasks

- [x] T1 Remote database connection and safe scripts. Route: delegated (2+ non-trivial files).
  - Acceptance: `createDatabase` passes `DATABASE_AUTH_TOKEN`; scripts never log credentials; `db:seed` refuses remote URLs unless explicitly confirmed.
  - Checks: unit tests first, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [x] T2 Vercel Blob attachment storage. Route: delegated (2+ non-trivial files).
  - Acceptance: with `BLOB_READ_WRITE_TOKEN`, attachments are saved, read and removed through Blob behind the existing port; the upload limit fits Vercel's request body limit with a clear error.
  - Checks: unit tests first with a stubbed client, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [x] T3 Deployment workflow and hosted login. Route: delegated (workflow, login and docs together).
  - Acceptance: main migrates before deploying and passes the new runtime env; staging stays ephemeral; the login shows demo credentials when enabled; README documents setup.
  - Checks: unit test for the login flag, YAML parse, `pnpm build`.
- [ ] T4 Provision and verify production. Route: inline (external actions).
  - Acceptance: Turso and Blob are provisioned, the database is seeded once, and Chromium completes login, navigation across all sections, a persisted create and an attachment round trip on production. Foreign key enforcement is confirmed on Turso.

## Progress

- T1 done in `3629aeb`. RED: `connect.test.ts` and `database-target.test.ts` failed on the missing `databaseClientConfig` and `database-target` module; GREEN 14 tests. `db:migrate` ran from a directory with no `.env`, and `db:seed` refused a fake remote URL with credentials, printing only the host and exiting 1. `pnpm db:generate` reports no schema changes under the `turso` dialect.
- T2 done in `357d3d0`. RED: 6 failing tests plus 2 missing modules (Blob adapter, factory, seed env, 4 MB rule, body limit); GREEN after implementation. `@vercel/blob` 2.8.2 supports `access: "private"` in `put` and `get`. A local seed with a Blob token stayed on disk; a confirmed remote seed without a token was refused.
- T3 done in `720455a`. RED: 4 `demoLoginNotice` tests; GREEN 10 tests in `demo-mode.test.ts`. Exception: the workflow has no runnable RED, so it was checked by parsing the YAML, reviewing the parsed steps and running the guard loop in bash with two empty values (exit 1, names only).
- Added to the plan during T1 to T3: remote seed refuses without `BLOB_READ_WRITE_TOKEN`; a local seed drops that token; the factory stays local in demo mode; staging pins `DATABASE_URL=file:/tmp/ikizen.db` and uses a per-deployment `BETTER_AUTH_SECRET`.
- Final checks on `720455a`: `pnpm lint` clean, `pnpm typecheck` clean, `pnpm test` 486 passed in 73 files, `pnpm build` succeeded, `pnpm test:e2e` 1 passed with `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium` (the bundled headless shell 1248 is not installed here).
- Pending: `.env.example` needs the new variables by hand. Remote behaviour (Turso, Blob) is unproven until T4.

## Next step

T4: provision Turso and Blob, set the GitHub secrets, seed once, and verify production in Chromium.
