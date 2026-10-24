"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { changePasswordAction, updateNameAction } from "@/server/actions/auth";

export function NameForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(updateNameAction, initialActionState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Ad soyad"
        name="name"
        autoComplete="name"
        required
        defaultValue={state.values?.name ?? name}
        errors={state.fieldErrors?.name}
      />
      <SubmitButton className="justify-self-start">Kaydet</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialActionState);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Mevcut şifre"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.currentPassword}
      />
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
      <SubmitButton className="justify-self-start">Şifreyi değiştir</SubmitButton>
    </form>
  );
}
