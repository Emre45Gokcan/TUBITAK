"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { joinClassroomAction } from "@/server/actions/enrollments";

export function JoinForm() {
  const [state, formAction] = useActionState(joinClassroomAction, initialActionState);
  const errors = state.fieldErrors?.code;
  return (
    <form action={formAction} className="grid gap-3" noValidate>
      {!errors && <FormAlert state={state} />}
      <Label htmlFor="code">Katılım kodu</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          placeholder="ABC2DEF"
          className="max-w-48 font-mono uppercase tracking-widest"
          defaultValue={state.values?.code}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? "code-error" : "code-hint"}
        />
        <SubmitButton>Sınıfa katıl</SubmitButton>
      </div>
      {errors ? (
        <FieldError id="code-error" errors={errors} />
      ) : (
        <p id="code-hint" className="text-xs text-muted-foreground">
          Kodu öğretmeninizden alın.
        </p>
      )}
    </form>
  );
}
