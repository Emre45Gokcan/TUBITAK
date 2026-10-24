import { describe, expect, it } from "vitest";
import { normalizeEmotion } from "./robot-config";
import { robotConfigSchema } from "./validation";
import { encodeWav, parseWav, toneWav } from "./wav";

describe("normalizeEmotion", () => {
  it("keeps supported emotions and falls back to neutral", () => {
    expect(normalizeEmotion("happy")).toBe("happy");
    expect(normalizeEmotion("angry")).toBe("angry");
    expect(normalizeEmotion("ecstatic")).toBe("neutral");
    expect(normalizeEmotion(undefined)).toBe("neutral");
    expect(normalizeEmotion(42)).toBe("neutral");
  });

  it("shows neutral when the expression is disabled for the robot", () => {
    expect(normalizeEmotion("angry", ["neutral", "happy"])).toBe("neutral");
  });
});

describe("parseWav", () => {
  it("reads format and duration", () => {
    const info = parseWav(encodeWav(new Int16Array(16000 * 2), 16000));
    expect(info).toMatchObject({ format: 1, channels: 1, sampleRate: 16000, bitsPerSample: 16 });
    expect(info?.durationSeconds).toBeCloseTo(2);
  });

  it("rejects non-WAV data", () => {
    expect(parseWav(new TextEncoder().encode("ID3 this is an mp3 file, not a wav file at all"))).toBeNull();
    expect(parseWav(new Uint8Array(10))).toBeNull();
  });

  it("skips extra chunks before data", () => {
    const wav = encodeWav(new Int16Array(800), 16000);
    // Insert a 4-byte LIST chunk after "fmt ".
    const list = new Uint8Array([0x4c, 0x49, 0x53, 0x54, 4, 0, 0, 0, 1, 2, 3, 4]);
    const withList = new Uint8Array([...wav.subarray(0, 36), ...list, ...wav.subarray(36)]);
    expect(parseWav(withList)?.durationSeconds).toBeCloseTo(0.05);
  });

  it("mock speech is a valid WAV", () => {
    expect(parseWav(toneWav(1.5))?.durationSeconds).toBeCloseTo(1.5);
  });
});

describe("robotConfigSchema", () => {
  const base = {
    name: "Companion 01",
    model: "claude-opus-5-5",
    personality: "Sen arkadaş canlısı bir robotsun.",
    voice: "nova",
    memoryEnabled: true,
  };

  it("always keeps neutral among enabled emotions", () => {
    expect(robotConfigSchema.parse({ ...base, enabledEmotions: ["angry"] }).enabledEmotions).toEqual([
      "neutral",
      "angry",
    ]);
  });

  it("rejects unknown models and voices", () => {
    expect(robotConfigSchema.safeParse({ ...base, model: "gpt-4", enabledEmotions: [] }).success).toBe(false);
    expect(robotConfigSchema.safeParse({ ...base, voice: "robot", enabledEmotions: [] }).success).toBe(false);
  });
});
