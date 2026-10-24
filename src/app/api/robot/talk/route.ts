import { ROBOT_MAX_UPLOAD_BYTES } from "@/lib/robot-config";
import {
  RobotApiError,
  authenticateRobot,
  requireRobotRateLimit,
  robotErrorResponse,
  robotJson,
} from "@/server/robot/api";
import { talk } from "@/server/robot/talk";

// STT + LLM + TTS in one request.
export const maxDuration = 60;

/**
 * POST /api/robot/talk
 * Headers: Authorization: Bearer <token>, X-Robot-Id: <device id>
 * Body: multipart/form-data with an `audio` field (WAV, ≤ 4 MB, ≤ 60 s).
 */
export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > ROBOT_MAX_UPLOAD_BYTES) {
      throw new RobotApiError(413, "PAYLOAD_TOO_LARGE", "Ses dosyası en fazla 4 MB olabilir.");
    }

    const robot = await authenticateRobot(request);
    await requireRobotRateLimit(robot.id, "talk", 30, 600);

    const form = await request.formData().catch(() => null);
    const audio = form?.get("audio");
    if (!(audio instanceof File)) {
      throw new RobotApiError(400, "INVALID_AUDIO", "İstekte `audio` alanında bir WAV dosyası bekleniyor.");
    }
    if (audio.size > ROBOT_MAX_UPLOAD_BYTES) {
      throw new RobotApiError(413, "PAYLOAD_TOO_LARGE", "Ses dosyası en fazla 4 MB olabilir.");
    }

    const result = await talk(robot, new Uint8Array(await audio.arrayBuffer()));
    return robotJson({
      success: true,
      robotId: robot.deviceId,
      transcript: result.transcript,
      text: result.text,
      emotion: result.emotion,
      audioUrl: new URL(`/api/robot/audio/${result.audioId}`, request.url).toString(),
      audioExpiresAt: result.audioExpiresAt.toISOString(),
    });
  } catch (error) {
    return robotErrorResponse(error);
  }
}
