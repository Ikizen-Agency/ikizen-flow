import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile?.(".env");
} catch {
  // No .env file: fall back to the default local database.
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL?.trim() || "file:./data/ikizen.db",
  },
  strict: true,
  verbose: true,
});
