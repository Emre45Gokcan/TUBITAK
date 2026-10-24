import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD, isLocalDatabaseUrl, seedSafetyProblem } from "./seed-safety";

const LOCAL = "postgres://postgres:postgres@localhost:5433/app";
const NEON = "postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const STRONG = "a-long-new-admin-password-2026";

describe("isLocalDatabaseUrl", () => {
  it("accepts only this computer", () => {
    expect(isLocalDatabaseUrl(LOCAL)).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u:p@127.0.0.1:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u:p@[::1]:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl(NEON)).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
    expect(isLocalDatabaseUrl(undefined)).toBe(false);
  });
});

describe("seedSafetyProblem", () => {
  it("allows everything on the local database, including demo data", () => {
    expect(seedSafetyProblem({ databaseUrl: LOCAL, demo: true, adminPassword: "short123" })).toBeNull();
  });

  it("refuses demo accounts on any other database", () => {
    expect(seedSafetyProblem({ databaseUrl: NEON, demo: true, adminPassword: STRONG })).toMatch(/--demo/);
  });

  it("requires a long, new admin password on any other database", () => {
    expect(seedSafetyProblem({ databaseUrl: NEON, demo: false, adminPassword: "short-pass" })).toMatch(/12/);
    expect(seedSafetyProblem({ databaseUrl: NEON, demo: false, adminPassword: DEMO_PASSWORD })).toMatch(/yeni/);
    expect(
      seedSafetyProblem({ databaseUrl: NEON, demo: false, adminPassword: STRONG, localAdminPassword: STRONG }),
    ).toMatch(/yeni/);
    expect(
      seedSafetyProblem({ databaseUrl: NEON, demo: false, adminPassword: STRONG, localAdminPassword: "other" }),
    ).toBeNull();
  });
});
