import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/server/db/connect";
import { loadDatabaseUrl } from "./env";

const url = loadDatabaseUrl();
const { db, client } = createDatabase(url);
await migrate(db, { migrationsFolder: "./drizzle" });
client.close();
console.log(`Migrations applied to ${url}`);
