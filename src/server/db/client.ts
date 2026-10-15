import "server-only";
import { createDatabase, type Database } from "./connect";

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __ikizenDb?: Database };

export const db: Database = globalForDb.__ikizenDb ?? createDatabase().db;

if (process.env.NODE_ENV !== "production") globalForDb.__ikizenDb = db;
