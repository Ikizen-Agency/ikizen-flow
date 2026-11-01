import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env file: fall back to the default local database.
}

export default defineConfig({
  // `turso` is the libSQL dialect: the only one that accepts an auth token, and it reads `file:` URLs too.
  dialect: "turso",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL?.trim() || "file:./data/ikizen.db",
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  },
  strict: true,
  verbose: true,
});
