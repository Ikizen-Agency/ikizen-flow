import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "@/server/db/connect";

/** Creates a migrated, file-backed SQLite database in a temp dir (libSQL transactions need a file). */
export async function createTestDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "ikizen-test-"));
  const { db, client } = createDatabase(`file:${join(dir, "test.db")}`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  return {
    db,
    cleanup: () => {
      client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
