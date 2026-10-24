import { authenticateRobot, requireRobotRateLimit, robotErrorResponse, robotJson } from "@/server/robot/api";

/**
 * POST /api/robot/heartbeat — sent every ~30 s so the dashboard can show the robot as connected.
 * Headers: Authorization: Bearer <token>, X-Robot-Id: <device id>
 */
export async function POST(request: Request) {
  try {
    const robot = await authenticateRobot(request);
    await requireRobotRateLimit(robot.id, "heartbeat", 12, 60);
    return robotJson({
      success: true,
      robotId: robot.deviceId,
      name: robot.name,
      enabledEmotions: robot.enabledEmotions,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return robotErrorResponse(error);
  }
}
