import { createDatabase } from "../src/server/db/connect";
import { LocalAttachmentStorage, resolveUploadsDir } from "../src/modules/tasks/infrastructure/local-attachment-storage";
import { seedDatabase } from "../src/server/db/seed/seed";
import { loadDatabaseUrl } from "./env";

const url = loadDatabaseUrl();
const { db, client } = createDatabase(url);
// Seeded attachments are rewritten from scratch; files of the previous dataset are removed first.
const attachmentStorage = new LocalAttachmentStorage(resolveUploadsDir(process.env));
await attachmentStorage.clear();
const summary = await seedDatabase(db, new Date(), { attachmentStorage });
client.close();
console.log(`Seeded ${url}:`, summary);
