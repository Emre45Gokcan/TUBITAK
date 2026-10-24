import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { USER_ROLES, USER_STATUSES } from "@/db/schema";
import { accountIntent } from "@/lib/account-intent";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

/**
 * Locally (and in scripts) this is BETTER_AUTH_URL or localhost. On Vercel the
 * base URL is resolved per request from an allow-list of this project's own
 * hosts, so production, branch and deployment URLs all work.
 */
function baseURL(): BetterAuthOptions["baseURL"] {
  const explicit = process.env.BETTER_AUTH_URL;
  const vercelHosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ].filter((host): host is string => Boolean(host));

  if (vercelHosts.length === 0) return explicit ?? "http://localhost:3000";

  return {
    allowedHosts: [...(explicit ? [new URL(explicit).host] : []), ...vercelHosts],
    fallback: explicit ?? `https://${vercelHosts[0]}`,
    protocol: "https",
  };
}

export const auth = betterAuth({
  appName: process.env.APP_NAME ?? "Sınıf Platformu",
  baseURL: baseURL(),
  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user, url);
    },
  },

  user: {
    additionalFields: {
      // `input: false`: never accepted from sign-up or update-user requests.
      role: { type: [...USER_ROLES], input: false, required: true, defaultValue: "student" },
      status: { type: [...USER_STATUSES], input: false, required: true, defaultValue: "active" },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const intent = accountIntent.getStore();
          if (!intent) return;
          return { data: { ...user, role: intent.role, status: intent.status } };
        },
      },
    },
    session: {
      create: {
        // Runs on every sign-in, including auto sign-in after email verification.
        before: async (session) => {
          const [row] = await db
            .select({ status: schema.user.status })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          if (row?.status === "suspended") {
            throw APIError.from("FORBIDDEN", {
              code: "ACCOUNT_SUSPENDED",
              message: "Hesabınız askıya alınmıştır.",
            });
          }
        },
      },
    },
  },

  // In-memory counters don't survive across serverless instances.
  rateLimit: { storage: "database" },

  // Must be last: lets auth.api calls in Server Actions set cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
