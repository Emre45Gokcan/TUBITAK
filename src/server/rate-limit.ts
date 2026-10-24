import "server-only";
import { lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { actionRateLimit } from "@/db/schema";

export const RATE_LIMITED_MESSAGE =
  "Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.";

/** Vercel overwrites these headers with the real client address. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Counts one attempt for `key` and returns false once `max` attempts were made
 * within the current `windowSeconds` window. Single atomic upsert, so
 * concurrent requests can't slip past the limit.
 */
export async function consumeRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const expired = sql`${actionRateLimit.windowStart} < now() - make_interval(secs => ${windowSeconds}::double precision)`;
  const [row] = await db
    .insert(actionRateLimit)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: actionRateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${actionRateLimit.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${actionRateLimit.windowStart} end`,
      },
    })
    .returning({ count: actionRateLimit.count });

  // Occasionally drop stale counters so the table stays small.
  if (Math.random() < 0.01) {
    await db
      .delete(actionRateLimit)
      .where(lt(actionRateLimit.windowStart, sql`now() - interval '1 day'`));
  }

  return row.count <= max;
}

/** True only if every limit still has room (all counters are incremented). */
export async function withinRateLimits(
  limits: Array<{ key: string; max: number; windowSeconds: number }>,
): Promise<boolean> {
  const results = await Promise.all(
    limits.map((l) => consumeRateLimit(l.key, l.max, l.windowSeconds)),
  );
  return results.every(Boolean);
}
