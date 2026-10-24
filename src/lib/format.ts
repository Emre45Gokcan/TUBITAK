import type { UserRole, UserStatus } from "@/lib/roles";

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeZone: "Europe/Istanbul",
});

export function formatDate(date: Date | string): string {
  return dateFormat.format(new Date(date));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Öğrenci",
  teacher: "Öğretmen",
  admin: "Yönetici",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Aktif",
  pending: "Onay bekliyor",
  rejected: "Reddedildi",
  suspended: "Askıya alındı",
};

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export function formatDateTime(date: Date | string): string {
  return dateTimeFormat.format(new Date(date));
}

const relative = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });

/** "az önce", "5 dakika önce", "2 gün önce"; takes seconds elapsed (computed by the DB clock). */
export function formatAgo(seconds: number | null): string {
  if (seconds === null) return "Hiç bağlanmadı";
  if (seconds < 45) return "az önce";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}
