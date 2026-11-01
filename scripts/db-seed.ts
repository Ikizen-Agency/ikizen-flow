import { createDatabase } from "../src/server/db/connect";
import { databaseTarget, decideSeed, seedStorageEnv } from "../src/server/db/database-target";
import { createAttachmentStorage } from "../src/modules/tasks/infrastructure/attachment-storage";
import { seedDatabase } from "../src/server/db/seed/seed";
import { loadDatabaseUrl } from "./env";

const url = loadDatabaseUrl();
const decision = decideSeed(url, process.env);
if (!decision.allowed) {
  console.error(decision.reason);
  process.exit(1);
}

const { db, client } = createDatabase(url);
// Fails on bad credentials or a missing migration before anything is deleted.
await client.execute('select 1 from "user" limit 1');
// Seeded attachments are rewritten from scratch; files of the previous dataset are removed first.
const attachmentStorage = createAttachmentStorage(seedStorageEnv(url, process.env));
await attachmentStorage.clear();
const summary = await seedDatabase(db, new Date(), { attachmentStorage });
client.close();
console.log(`Seeded ${databaseTarget(url)}:`, summary);
