// No I, L, O, 0 or 1: they are easy to confuse when read aloud or written on a board.
export const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 7;

export function generateJoinCode(): string {
  // Rejection sampling avoids modulo bias (256 isn't a multiple of 31).
  const limit = 256 - (256 % JOIN_CODE_ALPHABET.length);
  let code = "";
  while (code.length < JOIN_CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(JOIN_CODE_LENGTH * 2));
    for (const byte of bytes) {
      if (byte < limit && code.length < JOIN_CODE_LENGTH) {
        code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
      }
    }
  }
  return code;
}

/**
 * Locale-independent on purpose: `toLocaleUpperCase("tr")` would turn "i" into
 * "İ". Whitespace and dashes are dropped so "abc-d 23" style input still works.
 */
export function normalizeJoinCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidJoinCode(code: string): boolean {
  return (
    code.length === JOIN_CODE_LENGTH &&
    [...code].every((char) => JOIN_CODE_ALPHABET.includes(char))
  );
}
