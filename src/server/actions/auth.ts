"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AccountIntent, accountIntent } from "@/lib/account-intent";
import { type ActionState, formValues, validationError } from "@/lib/action-state";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateNameSchema,
} from "@/lib/validation";
import { RATE_LIMITED_MESSAGE, clientIp, withinRateLimits } from "@/server/rate-limit";
import { homePath, requireUser } from "@/server/session";

// Better Auth redirects here after the link in a verification email is opened.
const VERIFY_CALLBACK = "/eposta-dogrulama";

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["name", "email", "accountType"]);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, values);
  const { name, email, password, accountType } = parsed.data;

  const ip = await clientIp();
  if (!(await withinRateLimits([{ key: `signup:ip:${ip}`, max: 5, windowSeconds: 600 }]))) {
    return { error: RATE_LIMITED_MESSAGE, values };
  }

  // Teachers start as "pending" until an admin approves them.
  const intent: AccountIntent =
    accountType === "teacher"
      ? { role: "teacher", status: "pending" }
      : { role: "student", status: "active" };

  try {
    const requestHeaders = await headers();
    await accountIntent.run(intent, () =>
      auth.api.signUpEmail({
        body: { name, email, password, callbackURL: VERIFY_CALLBACK },
        headers: requestHeaders,
      }),
    );
  } catch (error) {
    return { error: authErrorMessage(error), values };
  }

  // Same response for new and already-registered emails (no account enumeration).
  redirect("/kayit/dogrulama");
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, values);
  const { email, password } = parsed.data;

  const ip = await clientIp();
  const allowed = await withinRateLimits([
    { key: `signin:ip:${ip}`, max: 10, windowSeconds: 60 },
    { key: `signin:email:${email}`, max: 10, windowSeconds: 600 },
  ]);
  if (!allowed) return { error: RATE_LIMITED_MESSAGE, values };

  let destination: string;
  try {
    const { user } = await auth.api.signInEmail({
      body: { email, password, callbackURL: VERIFY_CALLBACK },
      headers: await headers(),
    });
    destination = homePath(user);
  } catch (error) {
    return { error: authErrorMessage(error), values };
  }
  redirect(destination);
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/giris");
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = formValues(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, values);
  const { email } = parsed.data;

  const ip = await clientIp();
  const allowed = await withinRateLimits([
    { key: `reset:ip:${ip}`, max: 5, windowSeconds: 600 },
    { key: `reset:email:${email}`, max: 3, windowSeconds: 600 },
  ]);
  if (!allowed) return { error: RATE_LIMITED_MESSAGE, values };

  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/sifre-sifirla" },
      headers: await headers(),
    });
  } catch (error) {
    return { error: authErrorMessage(error), values };
  }
  return {
    success:
      "Bu e-posta adresiyle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderdik. Gelen kutunuzu kontrol edin.",
  };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { token, password } = parsed.data;

  try {
    await auth.api.resetPassword({
      body: { token, newPassword: password },
      headers: await headers(),
    });
  } catch (error) {
    return { error: authErrorMessage(error) };
  }
  redirect("/giris?sifre=yenilendi");
}

export async function updateNameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const values = formValues(formData, ["name"]);
  const parsed = updateNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, values);

  try {
    await auth.api.updateUser({ body: { name: parsed.data.name }, headers: await headers() });
  } catch (error) {
    return { error: authErrorMessage(error), values };
  }
  refresh();
  return { success: "Adınız güncellendi.", values: { name: parsed.data.name } };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const allowed = await withinRateLimits([
    { key: `change-password:user:${user.id}`, max: 5, windowSeconds: 600 },
  ]);
  if (!allowed) return { error: RATE_LIMITED_MESSAGE };

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.password,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    return { error: authErrorMessage(error) };
  }
  return { success: "Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı." };
}
