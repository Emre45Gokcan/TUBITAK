"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialActionState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="Yeni şifre"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="En az 8 karakter."
        errors={state.fieldErrors?.password}
      />
      <Field
        label="Yeni şifre (tekrar)"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton className="w-full">Şifreyi değiştir</SubmitButton>
    </form>
  );
}
