import "server-only";

/** Development only: fake STT/LLM/TTS so the pipeline runs without API keys or cost. Never on Vercel production. */
export function aiMockEnabled(): boolean {
  return process.env.ROBOT_AI_MOCK === "1" && process.env.VERCEL_ENV !== "production";
}
