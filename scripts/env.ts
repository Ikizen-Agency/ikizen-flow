import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Loads `.env` (if present) and returns the database URL used by CLI scripts. */
export function loadDatabaseUrl(): string {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Optional file.
  }
  const url = process.env.DATABASE_URL?.trim() || "file:./data/ikizen.db";
  const path = localFilePath(url);
  if (path) mkdirSync(dirname(path), { recursive: true });
  return url;
}

/** Absolute path of a `file:` database URL, or null for remote/in-memory databases. */
export function localFilePath(url: string): string | null {
  if (!url.startsWith("file:")) return null;
  return resolve(url.slice("file:".length));
}
