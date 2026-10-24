"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { signInAction } from "@/server/actions/auth";

export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialActionState);
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
      <div className="grid gap-1.5">
        <Field
          label="Şifre"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
        />
        <Link href="/sifremi-unuttum" className="justify-self-end text-xs text-muted-foreground hover:underline">
          Şifremi unuttum
        </Link>
      </div>
      <SubmitButton className="w-full">Giriş yap</SubmitButton>
    </form>
  );
}
