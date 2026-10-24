import type { z } from "zod";

/** Shape returned by every form Server Action (used with `useActionState`). */
export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Submitted values (never passwords) so the form can be re-filled after an error. */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = {};

export function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

export function validationError(error: z.ZodError, values?: Record<string, string>): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { error: "Lütfen formdaki hataları düzeltin.", fieldErrors, values };
}
