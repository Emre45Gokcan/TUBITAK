import { AsyncLocalStorage } from "node:async_hooks";
import type { UserRole, UserStatus } from "@/db/schema";

/**
 * Role/status that trusted server code wants a *newly created* user to get.
 *
 * `role` and `status` are `input: false` in Better Auth, so clients can never
 * set them. Server code (the sign-up action, the seed script) runs
 * `auth.api.signUpEmail` inside `accountIntent.run(...)`, and the
 * `user.create.before` hook in `auth.ts` applies it in the same INSERT.
 *
 * Applying it in the hook (instead of updating the row afterwards) matters:
 * for an email that is already registered, Better Auth returns a fake success
 * to prevent email enumeration and never runs the hook, so an existing
 * account's role can't be changed through sign-up.
 */
export type AccountIntent = { role: UserRole; status: UserStatus };

export const accountIntent = new AsyncLocalStorage<AccountIntent>();
