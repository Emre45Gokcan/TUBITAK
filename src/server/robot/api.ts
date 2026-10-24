import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { robot } from "@/db/schema";
import { clientIp, consumeRateLimit } from "@/server/rate-limit";
import { hashDeviceToken, tokenMatches } from "./credentials";

export type Robot = Omit<typeof robot.$inferSelect, "tokenHash">;

export type RobotErrorCode =
  | "UNAUTHORIZED"
  | "ROBOT_DEACTIVATED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_AUDIO"
  | "NOT_FOUND"
  | "AI_NOT_CONFIGURED"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

/** Thrown inside robot route handlers; turned into a JSON error by `robotErrorResponse`. */
export class RobotApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: RobotErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function robotJson(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function robotErrorResponse(error: unknown): Response {
  if (error instanceof RobotApiError) {
    return robotJson({ success: false, error: { code: error.code, message: error.message } }, error.status);
  }
  console.error("[robot-api]", error);
  return robotJson(
    { success: false, error: { code: "INTERNAL", message: "Beklenmeyen bir sunucu hatası oluştu." } },
    500,
  );
}

const DUMMY_HASH = hashDeviceToken("rbt_dummy");

/**
 * Robots authenticate with two headers:
 *   Authorization: Bearer <device token>
 *   X-Robot-Id: <device id>
 * Also records the request as a sign of life (`lastSeenAt`).
 */
export async function authenticateRobot(request: Request): Promise<Robot> {
  // Per-IP budget before any lookup slows down token guessing.
  if (!(await consumeRateLimit(`robot:ip:${await clientIp()}`, 120, 60))) {
    throw new RobotApiError(429, "RATE_LIMITED", "Çok fazla istek. Lütfen biraz bekleyin.");
  }

  const deviceId = request.headers.get("x-robot-id")?.trim() ?? "";
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!deviceId || !token || deviceId.length > 32) {
    throw new RobotApiError(401, "UNAUTHORIZED", "Robot kimliği veya anahtarı eksik.");
  }

  const [row] = await db.select().from(robot).where(eq(robot.deviceId, deviceId));
  // Compare even when the robot doesn't exist, so timing doesn't reveal valid device ids.
  const valid = tokenMatches(token, row?.tokenHash ?? DUMMY_HASH);
  if (!row || !valid) throw new RobotApiError(401, "UNAUTHORIZED", "Robot kimliği veya anahtarı geçersiz.");
  if (row.deactivatedAt) throw new RobotApiError(403, "ROBOT_DEACTIVATED", "Bu robot devre dışı bırakılmış.");

  const { tokenHash, ...rest } = row;
  const lastSeenAt = new Date();
  // Keep updatedAt for configuration changes, not for every sign of life.
  await db
    .update(robot)
    .set({ lastSeenAt, updatedAt: row.updatedAt })
    .where(and(eq(robot.id, row.id), eq(robot.tokenHash, tokenHash)));
  return { ...rest, lastSeenAt };
}

export async function requireRobotRateLimit(robotId: string, action: string, max: number, windowSeconds: number) {
  if (!(await consumeRateLimit(`robot:${action}:${robotId}`, max, windowSeconds))) {
    throw new RobotApiError(429, "RATE_LIMITED", "Çok fazla istek. Lütfen biraz bekleyin.");
  }
}
