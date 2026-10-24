import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Lets Vercel Fluid compute close idle connections before a function suspends.
  attachDatabasePool(pool);
  return pool;
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgPool?: Pool };
export const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle({ client: pool, schema });
export type Db = typeof db;
