"use client";

import { type ComponentProps, type ReactNode, useActionState, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type ActionState, initialActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Sent as hidden inputs (e.g. ids). The server action re-checks permissions. */
  fields: Record<string, string>;
  children: ReactNode;
  confirm?: { title: string; description: string; confirmLabel: string };
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
};

/** A one-click Server Action button with toast feedback and optional confirmation dialog. */
export function ActionButton({ action, fields, children, confirm, variant, size }: Props) {
  const [open, setOpen] = useState(false);
  const [, formAction] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.error) toast.error(result.error);
    else if (result.success) toast.success(result.success);
    setOpen(false);
    return result;
  }, initialActionState);

  const form = (button: ReactNode) => (
    <form action={formAction}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {button}
    </form>
  );

  if (!confirm) {
    return form(
      <SubmitButton variant={variant} size={size}>
        {children}
      </SubmitButton>,
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} />}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirm.title}</DialogTitle>
          <DialogDescription>{confirm.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
          {form(
            <SubmitButton variant={variant === "destructive" ? "destructive" : "default"}>
              {confirm.confirmLabel}
            </SubmitButton>,
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
