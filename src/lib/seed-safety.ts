/**
 * Rules for `npm run db:seed` against a database that isn't on this computer (production).
 * The demo accounts share a password that is published in the README, and the production
 * admin must not start with a known password.
 */
export const DEMO_PASSWORD = "demo-sifre-123";
export const MIN_REMOTE_ADMIN_PASSWORD_LENGTH = 12;

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Why seeding must stop, or null when it's safe. Checked before anything is written. */
export function seedSafetyProblem(input: {
  databaseUrl: string | undefined;
  demo: boolean;
  adminPassword: string;
  localAdminPassword?: string;
}): string | null {
  if (isLocalDatabaseUrl(input.databaseUrl)) return null;
  if (input.demo) {
    return "--demo yalnızca yerel veritabanında kullanılabilir: demo hesaplarının şifresi README'de yazılı.";
  }
  if (input.adminPassword.length < MIN_REMOTE_ADMIN_PASSWORD_LENGTH) {
    return `Yerel olmayan bir veritabanında ADMIN_PASSWORD en az ${MIN_REMOTE_ADMIN_PASSWORD_LENGTH} karakter olmalı.`;
  }
  if (input.adminPassword === DEMO_PASSWORD || input.adminPassword === input.localAdminPassword) {
    return "Üretim yöneticisi için yeni bir şifre seçin: demo şifresi veya yerel geliştirme şifresi kullanılamaz.";
  }
  return null;
}
