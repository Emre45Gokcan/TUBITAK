import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionState } from "@/lib/action-state";

export function FormAlert({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.success) {
    return (
      <Alert>
        <CircleCheckIcon />
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
