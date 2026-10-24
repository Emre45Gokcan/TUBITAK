import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeEmotion } from "@/lib/robot-config";
import { RobotApiError } from "./api";
import { aiMockEnabled } from "./mock";
import {
  type Reply,
  type ReplyInput,
  buildReplyRequest,
  interpretReply,
  replyEmotions,
  replySchema,
} from "./reply-format";

export type { HistoryMessage, Reply } from "./reply-format";

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  // No automatic retries: a failed paid request is reported, not repeated.
  // The timeout keeps the call inside the route's time budget.
  client ??= new Anthropic({ timeout: 40_000, maxRetries: 0 });
  return client;
}

/** Asks Claude for a spoken reply plus one of the robot's enabled emotions (structured output). */
export async function generateReply(input: ReplyInput): Promise<Reply> {
  const emotions = replyEmotions(input.enabledEmotions);

  if (aiMockEnabled()) {
    const turn = input.history.filter((m) => m.role === "user").length + 1;
    return {
      text: `Simülasyon yanıtı: bu konuşmadaki ${turn}. mesajını aldım.`,
      emotion: normalizeEmotion(["happy", "neutral", "angry"][turn % 3], emotions),
    };
  }

  const schema = replySchema(emotions);
  try {
    const response = await anthropic().messages.parse(buildReplyRequest(input, schema));
    const { usage } = response;
    console.info(
      `[robot-llm] model=${response.model} stop=${response.stop_reason} ` +
        `input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens} ` +
        `cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`,
    );
    if (response.stop_reason === "refusal") {
      console.warn(`[robot-llm] request declined (category: ${response.stop_details?.category ?? "unknown"}); not retried`);
    }
    return interpretReply(response, schema, emotions);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error("[robot-llm] credentials rejected", error.status);
      throw new RobotApiError(503, "AI_NOT_CONFIGURED", "Yapay zekâ servisi yapılandırılmamış.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new RobotApiError(503, "AI_UNAVAILABLE", "Yapay zekâ servisi şu an meşgul. Biraz sonra tekrar dene.");
    }
    if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.APIError) {
      console.error("[robot-llm] request failed", error);
      throw new RobotApiError(502, "AI_UNAVAILABLE", "Yapay zekâ servisine şu an ulaşılamıyor.");
    }
    // e.g. missing API key when the client is constructed
    console.error("[robot-llm] unexpected error", error);
    throw new RobotApiError(503, "AI_NOT_CONFIGURED", "Yapay zekâ servisi yapılandırılmamış.");
  }
}
