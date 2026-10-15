/**
 * Database connection factory. Not marked `server-only` so CLI scripts (migrate/seed) can use it;
 * application code must go through `@/server/db/client` instead.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:./data/ikizen.db";

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

export function createDatabase(url: string = resolveDatabaseUrl()) {
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof createDatabase>["db"];
