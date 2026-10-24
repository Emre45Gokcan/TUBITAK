import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
};

export function Field({ label, name, errors, hint, id = name, ...props }: FieldProps) {
  const hasError = Boolean(errors?.length);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && !hasError && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} errors={errors} />
    </div>
  );
}

export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {errors[0]}
    </p>
  );
}
