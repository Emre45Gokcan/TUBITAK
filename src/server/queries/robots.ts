import "server-only";
import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { robot, robotMessage } from "@/db/schema";
import { ROBOT_ONLINE_WINDOW_SECONDS } from "@/lib/robot-config";
import { uuidSchema } from "@/lib/validation";
import { requireRole } from "@/server/session";

// Everything except the token hash, which the dashboard never needs.
const publicColumns = Object.fromEntries(
  Object.entries(getTableColumns(robot)).filter(([key]) => key !== "tokenHash"),
) as Omit<ReturnType<typeof getTableColumns<typeof robot>>, "tokenHash">;

/** Connection status comes from the last heartbeat/request, computed by the database clock. */
const status = {
  online: sql<boolean>`coalesce(${robot.lastSeenAt} > now() - make_interval(secs => ${ROBOT_ONLINE_WINDOW_SECONDS}::double precision), false)`,
  secondsSinceSeen: sql<number | null>`extract(epoch from now() - ${robot.lastSeenAt})`.mapWith((v) =>
    v === null ? null : Number(v),
  ),
};

export async function listRobots() {
  await requireRole("admin");
  return db
    .select({ ...publicColumns, ...status })
    .from(robot)
    .orderBy(desc(robot.createdAt));
}

export async function getRobotForAdmin(id: string) {
  await requireRole("admin");
  if (!uuidSchema.safeParse(id).success) notFound();

  const [row] = await db
    .select({ ...publicColumns, ...status })
    .from(robot)
    .where(eq(robot.id, id));
  if (!row) notFound();

  const messages = await db
    .select({
      id: robotMessage.id,
      role: robotMessage.role,
      content: robotMessage.content,
      emotion: robotMessage.emotion,
      createdAt: robotMessage.createdAt,
    })
    .from(robotMessage)
    .where(eq(robotMessage.robotId, row.id))
    .orderBy(desc(robotMessage.createdAt))
    .limit(50);

  return { robot: row, messages: messages.reverse() };
}
