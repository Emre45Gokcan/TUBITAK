"use server";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classroom, enrollment } from "@/db/schema";
import { type ActionState, formValues, validationError } from "@/lib/action-state";
import { generateJoinCode } from "@/lib/join-code";
import { classroomSchema, uuidSchema } from "@/lib/validation";
import { isUniqueViolation } from "@/server/db-errors";
import { manageableBy } from "@/server/queries/classrooms";
import { requireRole } from "@/server/session";

const NOT_FOUND = "Sınıf bulunamadı.";
const JOIN_CODE_CONSTRAINT = "classroom_join_code_unique";

/** Retries with a fresh code on the (very unlikely) join-code collision. */
async function withUniqueJoinCode<T>(run: (code: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run(generateJoinCode());
    } catch (error) {
      if (attempt < 4 && isUniqueViolation(error, JOIN_CODE_CONSTRAINT)) continue;
      throw error;
    }
  }
}

function classroomId(formData: FormData): string | null {
  const parsed = uuidSchema.safeParse(formData.get("classroomId"));
  return parsed.success ? parsed.data : null;
}

export async function createClassroomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const teacher = await requireRole("teacher");
  const values = formValues(formData, ["name", "description"]);
  const parsed = classroomSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const created = await withUniqueJoinCode(async (joinCode) => {
    const [row] = await db
      .insert(classroom)
      .values({ ...parsed.data, teacherId: teacher.id, joinCode })
      .returning({ id: classroom.id });
    return row;
  });
  redirect(`/ogretmen/siniflar/${created.id}`);
}

/** Only the owning teacher edits; `classroomId` is bound by the page, not read from the form. */
export async function updateClassroomAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const teacher = await requireRole("teacher");
  const values = formValues(formData, ["name", "description"]);
  const parsed = classroomSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  if (!uuidSchema.safeParse(id).success) return { error: NOT_FOUND, values };

  const [updated] = await db
    .update(classroom)
    .set(parsed.data)
    .where(and(eq(classroom.id, id), eq(classroom.teacherId, teacher.id)))
    .returning({ id: classroom.id });
  if (!updated) return { error: NOT_FOUND, values };
  redirect(`/ogretmen/siniflar/${updated.id}`);
}

export async function regenerateJoinCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const teacher = await requireRole("teacher");
  const id = classroomId(formData);
  if (!id) return { error: NOT_FOUND };

  const updated = await withUniqueJoinCode(async (joinCode) => {
    const [row] = await db
      .update(classroom)
      .set({ joinCode })
      .where(and(eq(classroom.id, id), eq(classroom.teacherId, teacher.id)))
      .returning({ joinCode: classroom.joinCode });
    return row;
  });
  if (!updated) return { error: NOT_FOUND };
  refresh();
  return { success: `Yeni katılım kodu: ${updated.joinCode}. Eski kod artık çalışmaz.` };
}

export async function setJoinEnabledAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const teacher = await requireRole("teacher");
  const id = classroomId(formData);
  if (!id) return { error: NOT_FOUND };
  const joinEnabled = formData.get("joinEnabled") === "true";

  const [updated] = await db
    .update(classroom)
    .set({ joinEnabled })
    .where(and(eq(classroom.id, id), eq(classroom.teacherId, teacher.id)))
    .returning({ id: classroom.id });
  if (!updated) return { error: NOT_FOUND };
  refresh();
  return { success: joinEnabled ? "Sınıf yeni katılımlara açıldı." : "Sınıf yeni katılımlara kapatıldı." };
}

export async function setArchivedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireRole("teacher", "admin");
  const id = classroomId(formData);
  if (!id) return { error: NOT_FOUND };
  const archive = formData.get("archived") === "true";

  const [updated] = await db
    .update(classroom)
    .set({ archivedAt: archive ? new Date() : null })
    .where(
      and(
        eq(classroom.id, id),
        manageableBy(viewer),
        archive ? isNull(classroom.archivedAt) : isNotNull(classroom.archivedAt),
      ),
    )
    .returning({ id: classroom.id });
  if (!updated) return { error: NOT_FOUND };
  refresh();
  return { success: archive ? "Sınıf arşivlendi." : "Sınıf arşivden çıkarıldı." };
}

export async function removeStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireRole("teacher", "admin");
  const id = classroomId(formData);
  const studentId = String(formData.get("studentId") ?? "");
  if (!id || !studentId) return { error: NOT_FOUND };

  // Ownership check and delete in one statement.
  const manageable = db
    .select({ id: classroom.id })
    .from(classroom)
    .where(and(eq(classroom.id, id), manageableBy(viewer)));
  const removed = await db
    .delete(enrollment)
    .where(
      and(
        eq(enrollment.classroomId, id),
        eq(enrollment.studentId, studentId),
        inArray(enrollment.classroomId, manageable),
      ),
    )
    .returning({ studentId: enrollment.studentId });
  if (removed.length === 0) return { error: "Öğrenci bu sınıfta bulunamadı." };
  refresh();
  return { success: "Öğrenci sınıftan çıkarıldı." };
}
