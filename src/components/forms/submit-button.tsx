"use client";

import { Loader2Icon } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children, disabled, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || disabled} aria-busy={pending}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
