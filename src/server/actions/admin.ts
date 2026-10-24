"use server";

import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { USER_ROLES, classroom, session, user } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { sendTeacherApprovedEmail, sendTeacherRejectedEmail } from "@/lib/email";
import { requireRole } from "@/server/session";

const userIdSchema = z.string().min(1);
const NOT_FOUND = "Kullanıcı bulunamadı veya işlem için uygun değil.";

function loginUrl() {
  const base =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base}/giris`;
}

/** Admin-only, never on yourself (prevents an admin from locking themselves out). */
async function targetUserId(formData: FormData): Promise<string | { error: string }> {
  const admin = await requireRole("admin");
  const parsed = userIdSchema.safeParse(formData.get("userId"));
  if (!parsed.success) return { error: NOT_FOUND };
  if (parsed.data === admin.id) return { error: "Bu işlemi kendi hesabınızda yapamazsınız." };
  return parsed.data;
}

async function notify(send: () => Promise<void>) {
  try {
    await send();
  } catch (error) {
    // The status change already happened; a failed email shouldn't undo it.
    console.error("[admin] notification email failed", error);
  }
}

export async function approveTeacherAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = await targetUserId(formData);
  if (typeof id !== "string") return id;

  const [updated] = await db
    .update(user)
    .set({ status: "active" })
    .where(and(eq(user.id, id), eq(user.role, "teacher"), inArray(user.status, ["pending", "rejected"])))
    .returning({ name: user.name, email: user.email });
  if (!updated) return { error: NOT_FOUND };

  await notify(() => sendTeacherApprovedEmail(updated, loginUrl()));
  refresh();
  return { success: `${updated.name} öğretmen olarak onaylandı.` };
}

export async function rejectTeacherAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = await targetUserId(formData);
  if (typeof id !== "string") return id;

  const [updated] = await db
    .update(user)
    .set({ status: "rejected" })
    .where(and(eq(user.id, id), eq(user.role, "teacher"), eq(user.status, "pending")))
    .returning({ name: user.name, email: user.email });
  if (!updated) return { error: NOT_FOUND };

  await notify(() => sendTeacherRejectedEmail(updated));
  refresh();
  return { success: `${updated.name} adlı kullanıcının başvurusu reddedildi.` };
}

export async function changeRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = await targetUserId(formData);
  if (typeof id !== "string") return id;
  const role = z.enum(USER_ROLES).safeParse(formData.get("role"));
  if (!role.success) return { error: "Geçerli bir rol seçin." };

  if (role.data !== "teacher") {
    const [{ total }] = await db
      .select({ total: count() })
      .from(classroom)
      .where(and(eq(classroom.teacherId, id), isNull(classroom.archivedAt)));
    if (total > 0) {
      return { error: `Bu kullanıcının ${total} aktif sınıfı var. Önce sınıfları arşivleyin.` };
    }
  }

  const [current] = await db.select({ status: user.status }).from(user).where(eq(user.id, id));
  if (!current) return { error: NOT_FOUND };

  // Assigning a role is an explicit admin decision, so it also approves a
  // pending/rejected account. Suspended accounts stay suspended.
  const status = current.status === "suspended" ? "suspended" : "active";
  const [updated] = await db
    .update(user)
    .set({ role: role.data, status })
    .where(eq(user.id, id))
    .returning({ name: user.name });
  if (!updated) return { error: NOT_FOUND };

  refresh();
  return { success: `${updated.name} adlı kullanıcının rolü güncellendi.` };
}

export async function suspendUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = await targetUserId(formData);
  if (typeof id !== "string") return id;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(user)
      .set({ status: "suspended" })
      .where(eq(user.id, id))
      .returning({ name: user.name });
    // Signs the user out everywhere; the session hook in auth.ts blocks new sign-ins.
    if (row) await tx.delete(session).where(eq(session.userId, id));
    return row;
  });
  if (!updated) return { error: NOT_FOUND };

  refresh();
  return { success: `${updated.name} adlı kullanıcının hesabı askıya alındı.` };
}

export async function reactivateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = await targetUserId(formData);
  if (typeof id !== "string") return id;

  const [updated] = await db
    .update(user)
    .set({ status: "active" })
    .where(and(eq(user.id, id), eq(user.status, "suspended")))
    .returning({ name: user.name });
  if (!updated) return { error: NOT_FOUND };

  refresh();
  return { success: `${updated.name} adlı kullanıcının hesabı yeniden etkinleştirildi.` };
}
