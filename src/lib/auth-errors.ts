import { isAPIError } from "better-auth/api";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-posta veya şifre hatalı.",
  INVALID_PASSWORD: "Şifre hatalı.",
  INVALID_EMAIL: "Geçerli bir e-posta adresi girin.",
  EMAIL_NOT_VERIFIED:
    "E-posta adresiniz henüz doğrulanmadı. Size yeni bir doğrulama bağlantısı gönderdik.",
  USER_ALREADY_EXISTS: "Bu e-posta adresiyle kayıtlı bir hesap zaten var.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu e-posta adresiyle kayıtlı bir hesap zaten var.",
  PASSWORD_TOO_SHORT: "Şifre en az 8 karakter olmalı.",
  PASSWORD_TOO_LONG: "Şifre en fazla 128 karakter olabilir.",
  INVALID_TOKEN: "Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.",
  TOKEN_EXPIRED: "Bağlantının süresi dolmuş. Lütfen yeni bir bağlantı isteyin.",
  ACCOUNT_SUSPENDED: "Hesabınız askıya alınmıştır. Lütfen yöneticinizle iletişime geçin.",
  SESSION_EXPIRED: "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Bu hesap için şifre tanımlı değil.",
};

const STATUS_MESSAGES: Record<number, string> = {
  429: "Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.",
};

const FALLBACK = "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";

/** Turns a Better Auth error into a Turkish message safe to show to users. */
export function authErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    const code = typeof error.body?.code === "string" ? error.body.code : undefined;
    if (code && MESSAGES[code]) return MESSAGES[code];
    if (STATUS_MESSAGES[error.statusCode]) return STATUS_MESSAGES[error.statusCode];
  }
  console.error("[auth]", error);
  return FALLBACK;
}

export function authErrorCode(error: unknown): string | undefined {
  if (isAPIError(error) && typeof error.body?.code === "string") return error.body.code;
  return undefined;
}
