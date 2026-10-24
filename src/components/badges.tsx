import { Badge } from "@/components/ui/badge";
import type { UserRole, UserStatus } from "@/lib/roles";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/format";

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge variant={role === "admin" ? "default" : "secondary"}>{ROLE_LABELS[role]}</Badge>;
}

export function StatusBadge({ status }: { status: UserStatus }) {
  const variant = status === "active" ? "outline" : status === "pending" ? "secondary" : "destructive";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}
