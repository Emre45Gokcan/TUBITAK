"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { forgotPasswordAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialActionState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="E-posta"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton className="w-full">Sıfırlama bağlantısı gönder</SubmitButton>
    </form>
  );
}
