import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/server/db/connect";
import { LocalAttachmentStorage, resolveUploadsDir } from "../src/modules/tasks/infrastructure/local-attachment-storage";
import { seedDatabase } from "../src/server/db/seed/seed";
import { loadDatabaseUrl, localFilePath } from "./env";

const url = loadDatabaseUrl();
const path = localFilePath(url);
if (!path) {
  console.error("db:reset only supports local file databases (DATABASE_URL=file:...).");
  process.exit(1);
}
for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${path}${suffix}`, { force: true });

const { db, client } = createDatabase(url);
await migrate(db, { migrationsFolder: "./drizzle" });
// Seeded attachments are rewritten from scratch; files of the previous dataset are removed first.
const attachmentStorage = new LocalAttachmentStorage(resolveUploadsDir(process.env));
await attachmentStorage.clear();
const summary = await seedDatabase(db, new Date(), { attachmentStorage });
client.close();
console.log(`Reset ${url}:`, summary);
