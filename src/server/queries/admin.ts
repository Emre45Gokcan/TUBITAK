import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
  classroom,
  enrollment,
  user,
} from "@/db/schema";
import { requireRole } from "@/server/session";

export const PAGE_SIZE = 25;

/** Escapes LIKE wildcards so user input is matched literally. */
function containsPattern(input: string) {
  return `%${input.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function getAdminOverview() {
  await requireRole("admin");
  const [byRole, [pending], [classrooms]] = await Promise.all([
    db.select({ role: user.role, total: count() }).from(user).groupBy(user.role),
    db
      .select({ total: count() })
      .from(user)
      .where(and(eq(user.role, "teacher"), eq(user.status, "pending"))),
    db.select({ total: count() }).from(classroom),
  ]);
  const roleTotals = Object.fromEntries(USER_ROLES.map((r) => [r, 0])) as Record<UserRole, number>;
  for (const row of byRole) roleTotals[row.role] = row.total;
  return { roleTotals, pendingTeachers: pending.total, classrooms: classrooms.total };
}

export async function listPendingTeachers() {
  await requireRole("admin");
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(and(eq(user.role, "teacher"), eq(user.status, "pending")))
    .orderBy(asc(user.createdAt));
}

export type UserFilters = { q?: string; role?: string; status?: string; page?: string };

export async function listUsers(filters: UserFilters) {
  await requireRole("admin");
  const conditions: (SQL | undefined)[] = [];
  const q = filters.q?.trim();
  if (q) conditions.push(or(ilike(user.name, containsPattern(q)), ilike(user.email, containsPattern(q))));
  if (USER_ROLES.includes(filters.role as UserRole)) conditions.push(eq(user.role, filters.role as UserRole));
  if (USER_STATUSES.includes(filters.status as UserStatus)) {
    conditions.push(eq(user.status, filters.status as UserStatus));
  }
  const where = and(...conditions);
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(user).where(where),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getUserForAdmin(id: string) {
  const admin = await requireRole("admin");
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, id));
  if (!row) notFound();

  const [teaching, enrolled] = await Promise.all([
    db
      .select({ id: classroom.id, name: classroom.name, archivedAt: classroom.archivedAt })
      .from(classroom)
      .where(eq(classroom.teacherId, row.id))
      .orderBy(desc(classroom.createdAt)),
    db
      .select({ id: classroom.id, name: classroom.name, archivedAt: classroom.archivedAt })
      .from(enrollment)
      .innerJoin(classroom, eq(classroom.id, enrollment.classroomId))
      .where(eq(enrollment.studentId, row.id))
      .orderBy(desc(enrollment.enrolledAt)),
  ]);
  return { user: row, isSelf: row.id === admin.id, teaching, enrolled };
}

export async function listAllClassrooms(filters: { q?: string; page?: string }) {
  await requireRole("admin");
  const q = filters.q?.trim();
  const where = q
    ? or(ilike(classroom.name, containsPattern(q)), ilike(user.name, containsPattern(q)))
    : undefined;
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: classroom.id,
        name: classroom.name,
        joinCode: classroom.joinCode,
        archivedAt: classroom.archivedAt,
        createdAt: classroom.createdAt,
        teacherName: user.name,
        studentCount: sql<number>`(select count(*) from ${enrollment} where ${enrollment.classroomId} = ${classroom.id})`.mapWith(Number),
      })
      .from(classroom)
      .innerJoin(user, eq(user.id, classroom.teacherId))
      .where(where)
      .orderBy(desc(classroom.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(classroom)
      .innerJoin(user, eq(user.id, classroom.teacherId))
      .where(where),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
