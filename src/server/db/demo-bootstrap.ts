/**
 * Bootstrap for the ephemeral demo mode (see `@/shared/config/demo-mode`): the database lives in `/tmp`,
 * so every fresh server instance migrates it and seeds the demo dataset before serving its first query.
 * Never used outside demo mode; local development keeps `pnpm db:reset`.
 */
import type { Client } from "@libsql/client";
import { count } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { AttachmentStorage } from "../../modules/tasks/application/ports";
import type { Database } from "./connect";
import { user } from "./schema";
import { seedDatabase } from "./seed/seed";

export interface DemoBootstrapOptions {
  migrationsFolder: string;
  /** Where the seeded attachment files are written; cleared before seeding. */
  attachmentStorage: AttachmentStorage & { clear(): Promise<void> };
  now?: Date;
}

/** Applies pending migrations (idempotent) and seeds the demo data only when no user exists yet. */
export async function bootstrapDemoDatabase(db: Database, { migrationsFolder, attachmentStorage, now = new Date() }: DemoBootstrapOptions): Promise<{ seeded: boolean }> {
  await migrate(db, { migrationsFolder });
  const [row] = await db.select({ users: count() }).from(user);
  if ((row?.users ?? 0) > 0) return { seeded: false };
  await attachmentStorage.clear();
  await seedDatabase(db, now, { attachmentStorage });
  return { seeded: true };
}

/** Memoizes an async task: concurrent callers share one run; a failed run is retried by the next caller. */
export function once(task: () => Promise<void>): () => Promise<void> {
  let pending: Promise<void> | null = null;
  return () => {
    pending ??= task().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

/** The libSQL client methods Drizzle uses to reach the database. */
const GATED_METHODS = new Set<PropertyKey>(["execute", "batch", "migrate", "transaction", "executeMultiple", "sync"]);

/** Wraps a libSQL client so every database call first awaits `ready` (the demo bootstrap). */
export function gateClient(client: Client, ready: () => Promise<void>): Client {
  return new Proxy(client, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== "function") return value;
      const method = value as (...args: unknown[]) => unknown;
      if (!GATED_METHODS.has(property)) return method.bind(target);
      return async (...args: unknown[]) => {
        await ready();
        return method.apply(target, args);
      };
    },
  });
}
