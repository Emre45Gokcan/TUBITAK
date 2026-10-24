"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { type ActionState, initialActionState } from "@/lib/action-state";
import { ROLE_LABELS } from "@/lib/format";
import { USER_ROLES, type UserRole } from "@/lib/roles";
import { changeRoleAction } from "@/server/actions/admin";

export function RoleForm({ userId, role }: { userId: string; role: UserRole }) {
  const [, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await changeRoleAction(prev, formData);
    if (result.error) toast.error(result.error);
    else if (result.success) toast.success(result.success);
    return result;
  }, initialActionState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-1.5">
        <Label htmlFor="role">Rol</Label>
        <NativeSelect id="role" name="role" defaultValue={role}>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton variant="outline">Rolü kaydet</SubmitButton>
    </form>
  );
}
