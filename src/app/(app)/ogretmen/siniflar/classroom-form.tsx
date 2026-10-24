"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FieldError } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ActionState, initialActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: { name: string; description: string | null };
  submitLabel: string;
  cancelHref: string;
};

export function ClassroomForm({ action, defaults, submitLabel, cancelHref }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const descriptionErrors = state.fieldErrors?.description;
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Sınıf adı"
        name="name"
        required
        maxLength={120}
        placeholder="ör. 9-A Matematik"
        defaultValue={state.values?.name ?? defaults?.name}
        errors={state.fieldErrors?.name}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="description">Açıklama (isteğe bağlı)</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={1000}
          defaultValue={state.values?.description ?? defaults?.description ?? ""}
          aria-invalid={descriptionErrors?.length ? true : undefined}
          aria-describedby={descriptionErrors?.length ? "description-error" : undefined}
        />
        <FieldError id="description-error" errors={descriptionErrors} />
      </div>
      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
