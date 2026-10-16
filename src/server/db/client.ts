import "server-only";
import { join } from "node:path";
import { LocalAttachmentStorage, resolveUploadsDir } from "@/modules/tasks/infrastructure/local-attachment-storage";
import { isEphemeralDemo } from "@/shared/config/demo-mode";
import { createDatabase, databaseFromClient, type Database } from "./connect";
import { bootstrapDemoDatabase, gateClient, once } from "./demo-bootstrap";

// Reuse one connection across hot reloads in development; share the demo bootstrap across route bundles.
const globalForDb = globalThis as unknown as { __ikizenDb?: Database; __ikizenDemoReady?: () => Promise<void> };

/**
 * In the ephemeral demo mode the `/tmp` database is migrated and seeded on the first query of each server
 * process; every query awaits that one bootstrap, kept on `globalThis` because separately bundled routes load
 * their own copy of this module. `drizzle/` is bundled via `outputFileTracingIncludes`.
 */
function createAppDatabase(): Database {
  const { db, client } = createDatabase();
  if (!isEphemeralDemo(process.env)) return db;
  const ready = (globalForDb.__ikizenDemoReady ??= once(async () => {
    const attachmentStorage = new LocalAttachmentStorage(resolveUploadsDir(process.env));
    const { seeded } = await bootstrapDemoDatabase(db, { migrationsFolder: join(process.cwd(), "drizzle"), attachmentStorage });
    console.info(`[demo] database ready${seeded ? " (seeded demo data)" : ""}`);
  }));
  return databaseFromClient(gateClient(client, ready));
}

export const db: Database = globalForDb.__ikizenDb ?? createAppDatabase();

if (process.env.NODE_ENV !== "production") globalForDb.__ikizenDb = db;
