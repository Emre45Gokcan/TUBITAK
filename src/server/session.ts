import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole, UserStatus } from "@/db/schema";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

/**
 * The signed-in user, or null. Role and status are read from the database on
 * every request (no cookie cache), so admin changes apply immediately.
 * `cache` dedupes calls within one render; Server Actions always re-check.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, role, status } = session.user;
  // Suspension deletes sessions; this also covers a status changed directly in the DB.
  if (status === "suspended") return null;
  return { id, name, email, role, status };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  return user;
}

/** Requires an *active* user with one of the given roles; otherwise sends them to their own home. */
export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.status !== "active" || !roles.includes(user.role)) redirect("/panel");
  return user;
}

/** For sign-in/sign-up pages: an already signed-in user goes straight to their home. */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user));
}

export function homePath(user: Pick<CurrentUser, "role" | "status">): string {
  if (user.status !== "active") return "/beklemede";
  switch (user.role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/ogretmen";
    case "student":
      return "/ogrenci";
  }
}
