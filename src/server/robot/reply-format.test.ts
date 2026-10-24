import { describe, expect, it } from "vitest";
import { DEFAULT_ROBOT_MODEL } from "@/lib/robot-config";
import { FALLBACK_REPLY, buildReplyRequest, interpretReply, replyEmotions, replySchema } from "./reply-format";

const input = {
  model: DEFAULT_ROBOT_MODEL,
  personality: "Sen arkadaş canlısı bir robotsun.",
  enabledEmotions: ["happy", "neutral", "angry"] as const,
  history: [],
  userText: "Merhaba, nasılsın?",
};
const emotions = replyEmotions(input.enabledEmotions);
const schema = replySchema(emotions);

describe("buildReplyRequest", () => {
  it("defaults to Claude Sonnet 5.5", () => {
    expect(DEFAULT_ROBOT_MODEL).toBe("claude-sonnet-5-5");
  });

  it("never asks the API to re-run a refusal on another model", () => {
    const request = buildReplyRequest(input, schema);
    expect(request).not.toHaveProperty("fallbacks");
    expect(request).not.toHaveProperty("betas");
    expect(request.model).toBe("claude-sonnet-5-5");
    expect(request.output_config.effort).toBe("low");
    expect(request.messages).toEqual([{ role: "user", content: "Merhaba, nasılsın?" }]);
  });

  it("uses no sampling parameters (Sonnet 5.5 rejects non-default values)", () => {
    const request = buildReplyRequest(input, schema) as Record<string, unknown>;
    for (const key of ["temperature", "top_p", "top_k", "thinking"]) expect(request).not.toHaveProperty(key);
  });
});

describe("interpretReply", () => {
  it("returns the polite fallback on a safety refusal (no retry)", () => {
    expect(interpretReply({ stop_reason: "refusal", parsed_output: null }, schema, emotions)).toEqual(FALLBACK_REPLY);
    expect(FALLBACK_REPLY.emotion).toBe("neutral");
  });

  it("uses the structured output", () => {
    expect(
      interpretReply({ stop_reason: "end_turn", parsed_output: { text: " İyiyim! ", emotion: "happy" } }, schema, emotions),
    ).toEqual({ text: "İyiyim!", emotion: "happy" });
  });

  it("falls back when the output is missing or invalid", () => {
    expect(interpretReply({ stop_reason: "max_tokens", parsed_output: null }, schema, emotions)).toEqual(FALLBACK_REPLY);
    expect(
      interpretReply({ stop_reason: "end_turn", parsed_output: { text: "x", emotion: "ecstatic" } }, schema, emotions),
    ).toEqual(FALLBACK_REPLY);
  });

  it("shows neutral for an emotion the robot has disabled", () => {
    const limited = replyEmotions(["neutral", "happy"]);
    const strictSchema = replySchema(limited);
    expect(
      interpretReply({ stop_reason: "end_turn", parsed_output: { text: "Hey", emotion: "angry" } }, strictSchema, limited),
    ).toEqual(FALLBACK_REPLY);
    expect(limited).toEqual(["neutral", "happy"]);
  });
});
