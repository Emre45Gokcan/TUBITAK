"use client";

import { useActionState } from "react";
import { Field, FieldError } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialActionState } from "@/lib/action-state";
import { signUpAction } from "@/server/actions/auth";

const ACCOUNT_TYPES = [
  {
    value: "student",
    title: "Öğrenci",
    text: "Öğretmeninizin verdiği kodla sınıflara katılın.",
  },
  {
    value: "teacher",
    title: "Öğretmen",
    text: "Sınıf oluşturun. Hesabınız yönetici onayından sonra açılır.",
  },
];

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialActionState);
  const accountType = state.values?.accountType || "student";

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormAlert state={state} />

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">Hesap türü</legend>
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map((type) => (
            <label
              key={type.value}
              className="grid cursor-pointer gap-1 rounded-lg p-3 ring-1 ring-foreground/10 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="accountType"
                  value={type.value}
                  defaultChecked={type.value === accountType}
                  className="accent-primary"
                />
                {type.title}
              </span>
              <span className="text-xs text-muted-foreground">{type.text}</span>
            </label>
          ))}
        </div>
        <FieldError id="accountType-error" errors={state.fieldErrors?.accountType} />
      </fieldset>

      <Field
        label="Ad soyad"
        name="name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
      <Field
        label="E-posta"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <Field
        label="Şifre"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="En az 8 karakter."
        errors={state.fieldErrors?.password}
      />
      <Field
        label="Şifre (tekrar)"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton className="w-full">Kayıt ol</SubmitButton>
    </form>
  );
}
