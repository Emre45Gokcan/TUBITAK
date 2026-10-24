// Request building and response handling for the robot's Claude call.
// Pure functions (no network, no "server-only"), so they can be unit-tested.
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { EMOTION_LABELS, type RobotEmotion, normalizeEmotion } from "@/lib/robot-config";

export type HistoryMessage = { role: "user" | "assistant"; content: string };
export type Reply = { text: string; emotion: RobotEmotion };
export type ReplyInput = {
  model: string;
  personality: string;
  enabledEmotions: readonly RobotEmotion[];
  history: HistoryMessage[];
  userText: string;
};

/** Said when Claude declines or the answer can't be used. Never retried on another model. */
export const FALLBACK_REPLY: Reply = {
  text: "Bunu şu an cevaplayamıyorum. Başka bir şey sormak ister misin?",
  emotion: "neutral",
};

const EMOTION_GUIDE: Record<RobotEmotion, string> = {
  happy: "olumlu, neşeli, heyecanlı ya da tebrik eden yanıtlar",
  neutral: "bilgi veren, sakin ya da emin olmadığın yanıtlar (varsayılan)",
  angry: "yalnızca şakacı bir sitem ya da kullanıcı kaba davrandığında kısa, nazik bir uyarı",
};

export function systemPrompt(personality: string, emotions: readonly RobotEmotion[]): string {
  const emotionLines = emotions
    .map((e) => `- ${e} (${EMOTION_LABELS[e]}): ${EMOTION_GUIDE[e]}`)
    .join("\n");
  return `Fiziksel bir yardımcı robotun sesisin. Yanıtın hoparlörden sesli okunacak ve robotun ekranında bir yüz ifadesi gösterilecek.

Kişilik ve talimatlar:
${personality}

Kurallar:
- Kullanıcıyla Türkçe konuş; kullanıcı başka bir dilde konuşursa o dilde yanıt ver.
- Yanıtlar konuşma dilinde ve kısa olsun (genellikle 1-3 cümle). Markdown, liste, emoji veya kod kullanma; sesli okunacak düz metin yaz.
- Kullanıcılar öğrenci olabilir: yaşa uygun, güvenli ve nazik ol.
- Ses yazıya çevrilirken hatalar olabilir; anlamadıysan kısaca tekrar etmesini iste.

"emotion" alanı yanıtınla birlikte gösterilecek yüz ifadesidir:
${emotionLines}`;
}

/** Neutral is always available so there is a valid face for every answer. */
export function replyEmotions(enabled: readonly RobotEmotion[]): [RobotEmotion, ...RobotEmotion[]] {
  return [...new Set<RobotEmotion>(["neutral", ...enabled])] as [RobotEmotion, ...RobotEmotion[]];
}

export function replySchema(emotions: [RobotEmotion, ...RobotEmotion[]]) {
  return z.object({
    text: z.string().describe("Robotun sesli söyleyeceği yanıt (düz metin)."),
    emotion: z.enum(emotions).describe("Yanıta eşlik eden yüz ifadesi."),
  });
}

export function buildReplyRequest(input: ReplyInput, schema: ReturnType<typeof replySchema>) {
  const messages: Anthropic.MessageParam[] = [...input.history, { role: "user", content: input.userText }];
  return {
    model: input.model,
    // Spoken replies are short; the cap leaves room for adaptive thinking.
    max_tokens: 4000,
    system: systemPrompt(input.personality, replyEmotions(input.enabledEmotions)),
    messages,
    // Structured output guarantees {text, emotion}; low effort keeps voice latency down.
    // No `fallbacks`: a safety refusal is final and is never re-run on another model.
    output_config: { effort: "low" as const, format: zodOutputFormat(schema) },
  };
}

/** Turns Claude's response into what the robot says and shows. */
export function interpretReply(
  response: { stop_reason: string | null; parsed_output?: unknown },
  schema: ReturnType<typeof replySchema>,
  emotions: readonly RobotEmotion[],
): Reply {
  if (response.stop_reason === "refusal") return FALLBACK_REPLY;
  const parsed = schema.safeParse(response.parsed_output);
  if (!parsed.success || !parsed.data.text.trim()) return FALLBACK_REPLY;
  return { text: parsed.data.text.trim(), emotion: normalizeEmotion(parsed.data.emotion, emotions) };
}
