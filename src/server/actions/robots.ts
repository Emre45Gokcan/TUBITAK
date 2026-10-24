"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { robot, robotAudio, robotMessage } from "@/db/schema";
import { type ActionState, formValues, validationError } from "@/lib/action-state";
import { createRobotSchema, robotConfigSchema, uuidSchema } from "@/lib/validation";
import { isUniqueViolation } from "@/server/db-errors";
import { generateDeviceId, generateDeviceToken } from "@/server/robot/credentials";
import { requireRole } from "@/server/session";

/** The plaintext token exists only in this response; the database keeps its hash. */
export type RobotCredentialsState = ActionState & {
  credentials?: { robotId: string; deviceId: string; token: string };
};

const NOT_FOUND = "Robot bulunamadı.";

function robotId(formData: FormData): string | null {
  const parsed = uuidSchema.safeParse(formData.get("robotId"));
  return parsed.success ? parsed.data : null;
}

export async function createRobotAction(
  _prev: RobotCredentialsState,
  formData: FormData,
): Promise<RobotCredentialsState> {
  const admin = await requireRole("admin");
  const values = formValues(formData, ["name"]);
  const parsed = createRobotSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { token, hash, hint } = generateDeviceToken();
  for (let attempt = 0; ; attempt++) {
    const deviceId = generateDeviceId();
    try {
      const [created] = await db
        .insert(robot)
        .values({ name: parsed.data.name, deviceId, tokenHash: hash, tokenHint: hint, createdById: admin.id })
        .returning({ id: robot.id, deviceId: robot.deviceId });
      return { success: "Robot oluşturuldu.", credentials: { robotId: created.id, deviceId: created.deviceId, token } };
    } catch (error) {
      if (attempt < 4 && isUniqueViolation(error, "robot_device_id_unique")) continue;
      throw error;
    }
  }
}

/** New token; the old one stops working immediately. */
export async function rotateRobotTokenAction(
  _prev: RobotCredentialsState,
  formData: FormData,
): Promise<RobotCredentialsState> {
  await requireRole("admin");
  const id = robotId(formData);
  if (!id) return { error: NOT_FOUND };

  const { token, hash, hint } = generateDeviceToken();
  const [updated] = await db
    .update(robot)
    .set({ tokenHash: hash, tokenHint: hint, tokenCreatedAt: new Date() })
    .where(eq(robot.id, id))
    .returning({ id: robot.id, deviceId: robot.deviceId });
  if (!updated) return { error: NOT_FOUND };
  // Speech generated for the old token's requests is no longer needed.
  await db.delete(robotAudio).where(eq(robotAudio.robotId, id));
  refresh();
  return {
    success: "Yeni anahtar oluşturuldu. Eski anahtar artık çalışmaz.",
    credentials: { robotId: updated.id, deviceId: updated.deviceId, token },
  };
}

export async function updateRobotAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const values = formValues(formData, ["name", "model", "personality", "voice"]);
  const parsed = robotConfigSchema.safeParse({
    ...values,
    memoryEnabled: formData.get("memoryEnabled") === "on",
    enabledEmotions: formData.getAll("enabledEmotions").map(String),
  });
  if (!parsed.success) return validationError(parsed.error, values);
  if (!uuidSchema.safeParse(id).success) return { error: NOT_FOUND, values };

  const [updated] = await db.update(robot).set(parsed.data).where(eq(robot.id, id)).returning({ id: robot.id });
  if (!updated) return { error: NOT_FOUND, values };
  refresh();
  return { success: "Robot ayarları kaydedildi.", values };
}

export async function setRobotActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = robotId(formData);
  if (!id) return { error: NOT_FOUND };
  const active = formData.get("active") === "true";

  const [updated] = await db
    .update(robot)
    .set({ deactivatedAt: active ? null : new Date() })
    .where(eq(robot.id, id))
    .returning({ name: robot.name });
  if (!updated) return { error: NOT_FOUND };
  refresh();
  return {
    success: active
      ? `${updated.name} yeniden etkinleştirildi.`
      : `${updated.name} devre dışı bırakıldı; anahtarı artık kabul edilmiyor.`,
  };
}

export async function clearRobotHistoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = robotId(formData);
  if (!id) return { error: NOT_FOUND };
  await db.delete(robotMessage).where(eq(robotMessage.robotId, id));
  refresh();
  return { success: "Konuşma geçmişi silindi." };
}

export async function deleteRobotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = robotId(formData);
  if (!id) return { error: NOT_FOUND };
  const deleted = await db.delete(robot).where(eq(robot.id, id)).returning({ id: robot.id });
  if (deleted.length === 0) return { error: NOT_FOUND };
  redirect("/admin/robotlar");
}
