/**
 * Database connection factory. Not marked `server-only` so CLI scripts (migrate/seed) can use it;
 * application code must go through `@/server/db/client` instead.
 */
import { createClient, type Client, type Config } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { DEMO_DATABASE_URL, isEphemeralDemo } from "../../shared/config/demo-mode";
import { isRemoteDatabaseUrl } from "./database-target";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:./data/ikizen.db";

/** `DATABASE_URL`, otherwise `/tmp` in the ephemeral demo mode, otherwise the local `data/` file. */
export function resolveDatabaseUrl(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return env.DATABASE_URL?.trim() || (isEphemeralDemo(env) ? DEMO_DATABASE_URL : DEFAULT_DATABASE_URL);
}

/** Client options for `url`: `DATABASE_AUTH_TOKEN` travels as its own option, and only to a remote database. */
export function databaseClientConfig(url: string, env: Readonly<Record<string, string | undefined>> = process.env): Config {
  const authToken = env.DATABASE_AUTH_TOKEN?.trim();
  return authToken && isRemoteDatabaseUrl(url) ? { url, authToken } : { url };
}

export function createDatabase(url: string = resolveDatabaseUrl(), env: Readonly<Record<string, string | undefined>> = process.env) {
  const client = createClient(databaseClientConfig(url, env));
  return { db: databaseFromClient(client), client };
}

export function databaseFromClient(client: Client) {
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof databaseFromClient>;
