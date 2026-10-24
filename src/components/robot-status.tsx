import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** "Bağlı" only while heartbeats arrive; existing in the database isn't enough. */
export function RobotStatusBadge({ online, deactivated }: { online: boolean; deactivated: boolean }) {
  if (deactivated) return <Badge variant="destructive">Devre dışı</Badge>;
  return (
    <Badge variant="outline" className="gap-1.5">
      <span
        className={cn("size-2 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground/40")}
        aria-hidden
      />
      {online ? "Bağlı" : "Bağlı değil"}
    </Badge>
  );
}
