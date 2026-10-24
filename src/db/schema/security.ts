import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Fixed-window counters for Server Actions. Better Auth's own `rate_limit`
 * table only covers requests to /api/auth/*; calling `auth.api.*` directly
 * from a Server Action bypasses that limiter.
 */
export const actionRateLimit = pgTable("action_rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});
