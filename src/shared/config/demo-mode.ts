/**
 * Ephemeral demo mode, used for the hosted portfolio demo on Vercel where there is no persistent disk.
 * The SQLite database and attachment files live in `/tmp`; each server instance migrates and seeds its own
 * copy on first database access, so data resets whenever an instance is recycled.
 * (No "server-only" import: plain environment parsing shared by the app and its tests.)
 */
export const DEMO_DATABASE_URL = "file:/tmp/ikizen.db";
export const DEMO_UPLOADS_DIR = "/tmp/ikizen-uploads";

/**
 * On with `IKIZEN_DEMO_MODE=ephemeral`, or automatically on Vercel (`VERCEL=1`) when no `DATABASE_URL` is configured.
 * A remote (non-`file:`) database is never a demo: demo mode migrates, seeds and wipes uploads at runtime.
 */
export function isEphemeralDemo(env: Readonly<Record<string, string | undefined>>): boolean {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl && !databaseUrl.startsWith("file:")) return false;
  if (env.IKIZEN_DEMO_MODE?.trim() === "ephemeral") return true;
  return env.VERCEL === "1" && !databaseUrl;
}
