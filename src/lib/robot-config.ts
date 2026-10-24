// Robot constants shared by the dashboard (client) and the robot API (server).
// No DB or SDK imports here.

export const ROBOT_EMOTIONS = ["happy", "neutral", "angry"] as const;
export type RobotEmotion = (typeof ROBOT_EMOTIONS)[number];

export const EMOTION_LABELS: Record<RobotEmotion, string> = {
  happy: "Mutlu",
  neutral: "Nötr",
  angry: "Kızgın",
};

/** Any value the robot might receive → a supported emotion it is allowed to show. */
export function normalizeEmotion(value: unknown, enabled: readonly RobotEmotion[] = ROBOT_EMOTIONS): RobotEmotion {
  return typeof value === "string" && (enabled as readonly string[]).includes(value)
    ? (value as RobotEmotion)
    : "neutral";
}

/** Conversation models (Anthropic). The first entry is the default. */
export const ROBOT_MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (varsayılan)" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (en yetenekli)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (en hızlı, en ekonomik)" },
] as const;
export type RobotModel = (typeof ROBOT_MODELS)[number]["id"];
export const DEFAULT_ROBOT_MODEL: RobotModel = ROBOT_MODELS[0].id;
export const ROBOT_PROVIDER_LABEL = "Anthropic Claude";

export function robotModelLabel(id: string): string {
  return ROBOT_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** OpenAI text-to-speech voices. */
export const ROBOT_VOICES = ["nova", "alloy", "ash", "coral", "echo", "fable", "onyx", "sage", "shimmer"] as const;
export type RobotVoice = (typeof ROBOT_VOICES)[number];
export const DEFAULT_ROBOT_VOICE: RobotVoice = "nova";

export const DEFAULT_PERSONALITY =
  "Sen arkadaş canlısı ve meraklı bir yardımcı robotsun. Doğal konuş, sohbet havasında kal ve gereksiz uzun cevaplar verme.";

/** A robot counts as connected if it sent a heartbeat or request within this window. */
export const ROBOT_ONLINE_WINDOW_SECONDS = 90;
/** Max upload accepted by /api/robot/talk (Vercel's request body limit is 4.5 MB). */
export const ROBOT_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ROBOT_MAX_RECORDING_SECONDS = 60;
