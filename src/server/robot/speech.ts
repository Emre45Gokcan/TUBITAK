import "server-only";
import { z } from "zod";
import type { RobotEmotion } from "@/lib/robot-config";
import { parseWav, toneWav } from "@/lib/wav";
import { RobotApiError } from "./api";
import { aiMockEnabled } from "./mock";

/**
 * Speech-to-text and text-to-speech through OpenAI's audio endpoints.
 * Models are configurable because the speech model line-up changes often.
 */
const OPENAI_URL = "https://api.openai.com/v1";
const STT_MODEL = process.env.OPENAI_STT_MODEL ?? "gpt-4o-mini-transcribe";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
// OpenAI's speech endpoint rejects longer inputs.
const TTS_MAX_CHARS = 4000;

function openAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new RobotApiError(503, "AI_NOT_CONFIGURED", "Konuşma servisi yapılandırılmamış (OPENAI_API_KEY).");
  return key;
}

async function openAiError(res: Response, what: string): Promise<never> {
  console.error(`[robot-speech] ${what} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  if (res.status === 401 || res.status === 403) {
    throw new RobotApiError(503, "AI_NOT_CONFIGURED", "Konuşma servisi anahtarı geçersiz.");
  }
  throw new RobotApiError(502, "AI_UNAVAILABLE", "Konuşma servisine şu an ulaşılamıyor.");
}

export async function transcribe(wav: Uint8Array): Promise<string> {
  if (aiMockEnabled()) {
    const seconds = parseWav(wav)?.durationSeconds ?? 0;
    return `Merhaba robot! (simülasyon: ${seconds.toFixed(1)} saniyelik kayıt)`;
  }

  const form = new FormData();
  form.append("file", new Blob([Buffer.from(wav)], { type: "audio/wav" }), "recording.wav");
  form.append("model", STT_MODEL);
  form.append("language", "tr");
  form.append("response_format", "json");

  const res = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey()}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) await openAiError(res, "transcription");
  const parsed = z.object({ text: z.string(), usage: z.unknown().optional() }).safeParse(await res.json());
  if (!parsed.success) throw new RobotApiError(502, "AI_UNAVAILABLE", "Ses yazıya çevrilemedi.");
  console.info(`[robot-speech] stt model=${STT_MODEL} usage=${JSON.stringify(parsed.data.usage ?? null)}`);
  return parsed.data.text.trim();
}

// Tone hints for models that accept `instructions` (the gpt-4o family).
const TONE: Record<RobotEmotion, string> = {
  happy: "Sıcak, neşeli ve enerjik bir tonla, doğal Türkçe konuş.",
  neutral: "Sakin, samimi ve doğal bir tonla Türkçe konuş.",
  angry: "Hafif sitemkar, kısa ve kararlı bir tonla Türkçe konuş; bağırma.",
};

export async function synthesize(
  text: string,
  voice: string,
  emotion: RobotEmotion,
): Promise<{ data: Uint8Array; contentType: string }> {
  if (aiMockEnabled()) {
    return { data: toneWav(Math.min(4, 0.75 + text.length * 0.03)), contentType: "audio/wav" };
  }

  const res = await fetch(`${OPENAI_URL}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice,
      input: text.slice(0, TTS_MAX_CHARS),
      response_format: "wav",
      ...(TTS_MODEL.startsWith("gpt-") ? { instructions: TONE[emotion] } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) await openAiError(res, "speech");
  const data = new Uint8Array(await res.arrayBuffer());
  const seconds = parseWav(data)?.durationSeconds;
  console.info(
    `[robot-speech] tts model=${TTS_MODEL} voice=${voice} input_chars=${text.length} ` +
      `audio_bytes=${data.length} audio_seconds=${seconds?.toFixed(1) ?? "?"}`,
  );
  return { data, contentType: "audio/wav" };
}
