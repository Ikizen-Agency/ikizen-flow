import { createDatabase } from "../src/server/db/connect";
import { databaseTarget, decideSeed } from "../src/server/db/database-target";
import { LocalAttachmentStorage, resolveUploadsDir } from "../src/modules/tasks/infrastructure/local-attachment-storage";
import { seedDatabase } from "../src/server/db/seed/seed";
import { loadDatabaseUrl } from "./env";

const url = loadDatabaseUrl();
const decision = decideSeed(url, process.env);
if (!decision.allowed) {
  console.error(decision.reason);
  process.exit(1);
}

const { db, client } = createDatabase(url);
// Seeded attachments are rewritten from scratch; files of the previous dataset are removed first.
const attachmentStorage = new LocalAttachmentStorage(resolveUploadsDir(process.env));
await attachmentStorage.clear();
const summary = await seedDatabase(db, new Date(), { attachmentStorage });
client.close();
console.log(`Seeded ${databaseTarget(url)}:`, summary);
