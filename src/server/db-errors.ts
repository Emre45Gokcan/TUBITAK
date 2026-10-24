import "server-only";

/** Postgres unique_violation (23505), optionally for a specific constraint. Drizzle wraps driver errors in `cause`. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    const pgError = e as { code?: string; constraint?: string };
    if (pgError.code === "23505") return !constraint || pgError.constraint === constraint;
  }
  return false;
}
