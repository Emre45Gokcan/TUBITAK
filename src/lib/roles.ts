// Plain constants (no DB imports) so Client Components can use them too.
export const USER_ROLES = ["student", "teacher", "admin"] as const;
export const USER_STATUSES = ["active", "pending", "rejected", "suspended"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
