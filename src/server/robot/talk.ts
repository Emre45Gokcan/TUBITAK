import "server-only";
import { desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { robotAudio, robotMessage } from "@/db/schema";
import { ROBOT_MAX_RECORDING_SECONDS, normalizeEmotion } from "@/lib/robot-config";
import { parseWav } from "@/lib/wav";
import { type Robot, RobotApiError } from "./api";
import { type HistoryMessage, type Reply, generateReply } from "./conversation";
import { synthesize, transcribe } from "./speech";

const HISTORY_LIMIT = 20;
const AUDIO_TTL_MS = 10 * 60 * 1000;
const DIDNT_HEAR: Reply = { text: "Seni duyamadım. Tekrar söyler misin?", emotion: "neutral" };

async function loadHistory(robotId: string): Promise<HistoryMessage[]> {
  const rows = await db
    .select({ role: robotMessage.role, content: robotMessage.content })
    .from(robotMessage)
    .where(eq(robotMessage.robotId, robotId))
    .orderBy(desc(robotMessage.createdAt))
    .limit(HISTORY_LIMIT);
  const history = rows.reverse();
  // The Messages API needs the conversation to start with a user turn.
  while (history[0]?.role === "assistant") history.shift();
  return history;
}

export type TalkResult = {
  transcript: string;
  text: string;
  emotion: Reply["emotion"];
  audioId: string;
  audioExpiresAt: Date;
};

/** One push-to-talk turn: WAV in → transcript → reply + emotion → speech stored for download. */
export async function talk(robot: Robot, wav: Uint8Array): Promise<TalkResult> {
  const info = parseWav(wav);
  if (!info) throw new RobotApiError(400, "INVALID_AUDIO", "Ses dosyası geçerli bir WAV dosyası değil.");
  if (info.durationSeconds > ROBOT_MAX_RECORDING_SECONDS) {
    throw new RobotApiError(413, "PAYLOAD_TOO_LARGE", `Kayıt en fazla ${ROBOT_MAX_RECORDING_SECONDS} saniye olabilir.`);
  }

  // Expired speech from earlier turns is no longer downloadable; drop it.
  await db.delete(robotAudio).where(lt(robotAudio.expiresAt, sql`now()`));

  const transcript = info.durationSeconds < 0.3 ? "" : await transcribe(wav);
  let reply = DIDNT_HEAR;
  if (transcript) {
    const history = robot.memoryEnabled ? await loadHistory(robot.id) : [];
    reply = await generateReply({
      model: robot.model,
      personality: robot.personality,
      enabledEmotions: robot.enabledEmotions,
      history,
      userText: transcript,
    });
  }
  const emotion = normalizeEmotion(reply.emotion, robot.enabledEmotions);
  const speech = await synthesize(reply.text, robot.voice, emotion);

  const now = Date.now();
  const audioExpiresAt = new Date(now + AUDIO_TTL_MS);
  const [audio] = await db
    .insert(robotAudio)
    .values({
      robotId: robot.id,
      data: Buffer.from(speech.data),
      contentType: speech.contentType,
      expiresAt: audioExpiresAt,
    })
    .returning({ id: robotAudio.id });

  if (robot.memoryEnabled && transcript) {
    // Explicit timestamps keep the user turn ordered before the reply.
    await db.insert(robotMessage).values([
      { robotId: robot.id, role: "user", content: transcript, createdAt: new Date(now) },
      { robotId: robot.id, role: "assistant", content: reply.text, emotion, createdAt: new Date(now + 1) },
    ]);
  }

  return { transcript, text: reply.text, emotion, audioId: audio.id, audioExpiresAt };
}
