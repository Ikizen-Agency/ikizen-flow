import { createDatabase } from "../src/server/db/connect";
import { seedDatabase } from "../src/server/db/seed/seed";
import { loadDatabaseUrl } from "./env";

const url = loadDatabaseUrl();
const { db, client } = createDatabase(url);
const summary = await seedDatabase(db, new Date());
client.close();
console.log(`Seeded ${url}:`, summary);
