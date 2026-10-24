"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classroom, enrollment } from "@/db/schema";
import { type ActionState, formValues, validationError } from "@/lib/action-state";
import { joinCodeSchema, uuidSchema } from "@/lib/validation";
import { RATE_LIMITED_MESSAGE, withinRateLimits } from "@/server/rate-limit";
import { requireRole } from "@/server/session";

export async function joinClassroomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await requireRole("student");
  const values = formValues(formData, ["code"]);
  const parsed = joinCodeSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  // Slows down guessing codes.
  const allowed = await withinRateLimits([
    { key: `join:user:${student.id}`, max: 10, windowSeconds: 600 },
  ]);
  if (!allowed) return { error: RATE_LIMITED_MESSAGE, values };

  const [target] = await db
    .select({ id: classroom.id, name: classroom.name })
    .from(classroom)
    .where(
      and(
        eq(classroom.joinCode, parsed.data.code),
        eq(classroom.joinEnabled, true),
        isNull(classroom.archivedAt),
      ),
    );
  if (!target) {
    return { error: "Bu koda sahip, katılıma açık bir sınıf bulunamadı.", values };
  }

  await db
    .insert(enrollment)
    .values({ classroomId: target.id, studentId: student.id })
    .onConflictDoNothing();
  redirect(`/ogrenci/siniflar/${target.id}`);
}

export async function leaveClassroomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const student = await requireRole("student");
  const parsed = uuidSchema.safeParse(formData.get("classroomId"));
  if (!parsed.success) return { error: "Sınıf bulunamadı." };

  const removed = await db
    .delete(enrollment)
    .where(and(eq(enrollment.classroomId, parsed.data), eq(enrollment.studentId, student.id)))
    .returning({ classroomId: enrollment.classroomId });
  if (removed.length === 0) return { error: "Bu sınıfa kayıtlı değilsiniz." };
  redirect("/ogrenci");
}
