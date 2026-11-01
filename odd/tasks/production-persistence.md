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

- [ ] T1 Remote database connection and safe scripts. Route: delegated (2+ non-trivial files).
  - Acceptance: `createDatabase` passes `DATABASE_AUTH_TOKEN`; scripts never log credentials; `db:seed` refuses remote URLs unless explicitly confirmed.
  - Checks: unit tests first, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [ ] T2 Vercel Blob attachment storage. Route: delegated (2+ non-trivial files).
  - Acceptance: with `BLOB_READ_WRITE_TOKEN`, attachments are saved, read and removed through Blob behind the existing port; the upload limit fits Vercel's request body limit with a clear error.
  - Checks: unit tests first with a stubbed client, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [ ] T3 Deployment workflow and hosted login. Route: delegated (workflow, login and docs together).
  - Acceptance: main migrates before deploying and passes the new runtime env; staging stays ephemeral; the login shows demo credentials when enabled; README documents setup.
  - Checks: unit test for the login flag, YAML parse, `pnpm build`.
- [ ] T4 Provision and verify production. Route: inline (external actions).
  - Acceptance: Turso and Blob are provisioned, the database is seeded once, and Chromium completes login, navigation across all sections, a persisted create and an attachment round trip on production. Foreign key enforcement is confirmed on Turso.

## Progress

Exploration finished. No task completed yet.

## Next step

Delegate T1 to T3 to one writer.
