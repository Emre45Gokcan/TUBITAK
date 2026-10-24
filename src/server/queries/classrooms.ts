import "server-only";
import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { classroom, enrollment, user } from "@/db/schema";
import { uuidSchema } from "@/lib/validation";
import { type CurrentUser, requireRole } from "@/server/session";

const studentCount = db
  .select({ classroomId: enrollment.classroomId, total: count().as("total") })
  .from(enrollment)
  .groupBy(enrollment.classroomId)
  .as("student_count");

/**
 * Which classrooms a viewer may manage: admins see all, teachers only their own.
 * Every teacher/admin query and mutation puts this in its WHERE clause.
 */
export function manageableBy(viewer: CurrentUser): SQL | undefined {
  return viewer.role === "admin" ? undefined : eq(classroom.teacherId, viewer.id);
}

export async function listMyTeachingClassrooms() {
  const teacher = await requireRole("teacher");
  return db
    .select({
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      joinCode: classroom.joinCode,
      joinEnabled: classroom.joinEnabled,
      archivedAt: classroom.archivedAt,
      createdAt: classroom.createdAt,
      studentCount: sql<number>`coalesce(${studentCount.total}, 0)`.mapWith(Number),
    })
    .from(classroom)
    .leftJoin(studentCount, eq(studentCount.classroomId, classroom.id))
    .where(eq(classroom.teacherId, teacher.id))
    .orderBy(sql`${classroom.archivedAt} is not null`, desc(classroom.createdAt));
}

/** A classroom the current teacher owns (or any classroom, for admins). 404 otherwise. */
export async function getManagedClassroom(id: string) {
  const viewer = await requireRole("teacher", "admin");
  if (!uuidSchema.safeParse(id).success) notFound();

  const [row] = await db
    .select({
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      joinCode: classroom.joinCode,
      joinEnabled: classroom.joinEnabled,
      archivedAt: classroom.archivedAt,
      createdAt: classroom.createdAt,
      teacherId: classroom.teacherId,
      teacherName: user.name,
      teacherEmail: user.email,
    })
    .from(classroom)
    .innerJoin(user, eq(user.id, classroom.teacherId))
    .where(and(eq(classroom.id, id), manageableBy(viewer)));
  if (!row) notFound();

  const students = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      enrolledAt: enrollment.enrolledAt,
    })
    .from(enrollment)
    .innerJoin(user, eq(user.id, enrollment.studentId))
    .where(eq(enrollment.classroomId, row.id))
    .orderBy(asc(user.name));

  return { viewer, classroom: row, students };
}

export async function listMyEnrolledClassrooms() {
  const student = await requireRole("student");
  return db
    .select({
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      archivedAt: classroom.archivedAt,
      teacherName: user.name,
      enrolledAt: enrollment.enrolledAt,
    })
    .from(enrollment)
    .innerJoin(classroom, eq(classroom.id, enrollment.classroomId))
    .innerJoin(user, eq(user.id, classroom.teacherId))
    .where(eq(enrollment.studentId, student.id))
    .orderBy(sql`${classroom.archivedAt} is not null`, desc(enrollment.enrolledAt));
}

/** A classroom the current student is enrolled in. 404 otherwise. */
export async function getMyEnrolledClassroom(id: string) {
  const student = await requireRole("student");
  if (!uuidSchema.safeParse(id).success) notFound();

  const [row] = await db
    .select({
      id: classroom.id,
      name: classroom.name,
      description: classroom.description,
      archivedAt: classroom.archivedAt,
      teacherName: user.name,
      enrolledAt: enrollment.enrolledAt,
      studentCount: sql<number>`coalesce(${studentCount.total}, 0)`.mapWith(Number),
    })
    .from(enrollment)
    .innerJoin(classroom, eq(classroom.id, enrollment.classroomId))
    .innerJoin(user, eq(user.id, classroom.teacherId))
    .leftJoin(studentCount, eq(studentCount.classroomId, classroom.id))
    .where(and(eq(enrollment.studentId, student.id), eq(classroom.id, id)));
  if (!row) notFound();
  return row;
}
