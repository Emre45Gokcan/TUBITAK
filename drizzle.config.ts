import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// ENV_FILE=.env.production.local npm run db:migrate  → run against another environment.
config({ path: process.env.ENV_FILE ? [process.env.ENV_FILE] : [".env.local", ".env"], quiet: true });

// Migrations need a direct (unpooled) connection. Neon's Vercel integration
// sets DATABASE_URL_UNPOOLED; locally both variables can point at the same DB.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is not set");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
