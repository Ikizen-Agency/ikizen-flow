/**
 * Database connection factory. Not marked `server-only` so CLI scripts (migrate/seed) can use it;
 * application code must go through `@/server/db/client` instead.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { DEMO_DATABASE_URL, isEphemeralDemo } from "../../shared/config/demo-mode";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:./data/ikizen.db";

/** `DATABASE_URL`, otherwise `/tmp` in the ephemeral demo mode, otherwise the local `data/` file. */
export function resolveDatabaseUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return env.DATABASE_URL?.trim() || (isEphemeralDemo(env) ? DEMO_DATABASE_URL : DEFAULT_DATABASE_URL);
}

export function createDatabase(url: string = resolveDatabaseUrl()) {
  const client = createClient({ url });
  return { db: databaseFromClient(client), client };
}

export function databaseFromClient(client: Client) {
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof databaseFromClient>;
