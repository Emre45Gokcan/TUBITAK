// Imported first by scripts so env vars exist before `@/db` creates the pool.
import { config } from "dotenv";

// ENV_FILE=.env.production.local npm run db:seed  → run against another environment.
config({ path: process.env.ENV_FILE ? [process.env.ENV_FILE] : [".env.local", ".env"], quiet: true });
