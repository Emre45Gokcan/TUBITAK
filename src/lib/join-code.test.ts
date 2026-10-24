import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "./join-code";

describe("generateJoinCode", () => {
  it("produces valid codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      expect(isValidJoinCode(code)).toBe(true);
    }
  });

  it("never uses look-alike characters", () => {
    for (const char of "ILO01") expect(JOIN_CODE_ALPHABET).not.toContain(char);
  });

  it("is effectively unique", () => {
    const codes = new Set(Array.from({ length: 5000 }, generateJoinCode));
    expect(codes.size).toBe(5000);
  });
});

describe("normalizeJoinCode", () => {
  it("uppercases and strips spaces and dashes", () => {
    expect(normalizeJoinCode(" abc-d 23e ")).toBe("ABCD23E");
  });

  it("is locale-independent (no Turkish dotted İ)", () => {
    expect(normalizeJoinCode("i")).toBe("I");
  });
});

describe("isValidJoinCode", () => {
  it("rejects wrong length and characters outside the alphabet", () => {
    expect(isValidJoinCode("ABC23")).toBe(false);
    expect(isValidJoinCode("ABCDEF1")).toBe(false);
    expect(isValidJoinCode("ABCDEFI")).toBe(false);
    expect(isValidJoinCode("ABCDEFG")).toBe(true);
  });
});
