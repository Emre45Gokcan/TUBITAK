import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const DEVICE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** e.g. "robot_k3m9x2pq" — public, sent by the device in `X-Robot-Id`. */
export function generateDeviceId(): string {
  const bytes = randomBytes(8);
  return `robot_${[...bytes].map((b) => DEVICE_ALPHABET[b % DEVICE_ALPHABET.length]).join("")}`;
}

/**
 * 256-bit random secret with a recognizable prefix (helps secret scanners).
 * High-entropy tokens don't need a slow password hash; SHA-256 is enough.
 */
export function generateDeviceToken(): { token: string; hash: string; hint: string } {
  const token = `rbt_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashDeviceToken(token), hint: token.slice(0, 10) };
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashDeviceToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
