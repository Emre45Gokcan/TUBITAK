/**
 * Creates the first admin from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD.
 * Safe to run repeatedly: existing emails are left untouched.
 *
 *   npm run db:seed              # admin only (use this in production)
 *   npm run db:seed -- --demo    # plus demo teachers, students and classes (local only)
 */
import "./load-env";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { type UserRole, type UserStatus, classroom, enrollment, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { generateJoinCode } from "@/lib/join-code";

type SeedUser = { name: string; email: string; password: string; role: UserRole; status: UserStatus };

async function ensureUser(seed: SeedUser): Promise<string> {
  const email = seed.email.trim().toLowerCase();
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) {
    console.log(`  = ${email} zaten var, atlandı`);
    return existing.id;
  }

  // Internal adapter: no verification email, and role/status are set directly
  // (the public sign-up endpoint can't set them).
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    { name: seed.name, email, emailVerified: true, role: seed.role, status: seed.status },
    { method: "email-password" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(seed.password),
  });
  console.log(`  + ${email} (${seed.role}, ${seed.status})`);
  return created.id;
}

async function seedDemo() {
  const password = "demo-sifre-123";
  const teacherId = await ensureUser({
    name: "Ayşe Yılmaz", email: "ayse@example.com", password, role: "teacher", status: "active",
  });
  await ensureUser({
    name: "Mehmet Kaya", email: "mehmet@example.com", password, role: "teacher", status: "pending",
  });
  const aliId = await ensureUser({
    name: "Ali Demir", email: "ali@example.com", password, role: "student", status: "active",
  });
  await ensureUser({
    name: "Zeynep Şahin", email: "zeynep@example.com", password, role: "student", status: "active",
  });

  const [existing] = await db
    .select({ id: classroom.id })
    .from(classroom)
    .where(eq(classroom.teacherId, teacherId));
  if (!existing) {
    const [math] = await db
      .insert(classroom)
      .values([
        { teacherId, name: "9-A Matematik", description: "Haftalık ödevler ve duyurular.", joinCode: generateJoinCode() },
        { teacherId, name: "Fizik Kulübü", description: null, joinCode: generateJoinCode() },
      ])
      .returning({ id: classroom.id });
    await db.insert(enrollment).values({ classroomId: math.id, studentId: aliId });
    console.log("  + 2 demo sınıf (Ali Demir 9-A Matematik'e kayıtlı)");
  }
  console.log(`\nDemo hesapların şifresi: ${password}`);
}

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL ve ADMIN_PASSWORD ortam değişkenlerini ayarlayın.");
  }
  if (ADMIN_PASSWORD.length < 8) throw new Error("ADMIN_PASSWORD en az 8 karakter olmalı.");

  console.log("Yönetici:");
  await ensureUser({
    name: ADMIN_NAME || "Yönetici",
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: "admin",
    status: "active",
  });

  if (process.argv.includes("--demo")) {
    console.log("Demo verisi:");
    await seedDemo();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
