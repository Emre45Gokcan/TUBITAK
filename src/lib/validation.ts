import { z } from "zod";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/join-code";
import { ROBOT_EMOTIONS, ROBOT_MODELS, ROBOT_VOICES, type RobotModel } from "@/lib/robot-config";

z.config(z.locales.tr());

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Geçerli bir e-posta adresi girin."));

const name = z
  .string()
  .trim()
  .min(2, "Ad en az 2 karakter olmalı.")
  .max(80, "Ad en fazla 80 karakter olabilir.");

const newPassword = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(128, "Şifre en fazla 128 karakter olabilir.");

const passwordsMatch = {
  check: (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword,
  params: { path: ["confirmPassword"], message: "Şifreler eşleşmiyor." },
};

export const signUpSchema = z
  .object({
    name,
    email,
    password: newPassword,
    confirmPassword: z.string(),
    accountType: z.enum(["student", "teacher"], "Hesap türünü seçin."),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Şifrenizi girin."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Bağlantı geçersiz."),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifrenizi girin."),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export const updateNameSchema = z.object({ name });

export const classroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Sınıf adı en az 2 karakter olmalı.")
    .max(120, "Sınıf adı en fazla 120 karakter olabilir."),
  description: z
    .string()
    .trim()
    .max(1000, "Açıklama en fazla 1000 karakter olabilir.")
    .transform((value) => value || null),
});

export const joinCodeSchema = z.object({
  code: z
    .string()
    .transform(normalizeJoinCode)
    .refine(isValidJoinCode, "Katılım kodu 7 karakterden oluşur (ör. ABC2DEF)."),
});

export const uuidSchema = z.uuid();

const robotName = z
  .string()
  .trim()
  .min(2, "Robot adı en az 2 karakter olmalı.")
  .max(80, "Robot adı en fazla 80 karakter olabilir.");

export const createRobotSchema = z.object({ name: robotName });

export const robotConfigSchema = z.object({
  name: robotName,
  model: z.enum(ROBOT_MODELS.map((m) => m.id) as [RobotModel, ...RobotModel[]], "Geçerli bir model seçin."),
  personality: z
    .string()
    .trim()
    .min(10, "Kişilik talimatı en az 10 karakter olmalı.")
    .max(2000, "Kişilik talimatı en fazla 2000 karakter olabilir."),
  voice: z.enum(ROBOT_VOICES, "Geçerli bir ses seçin."),
  memoryEnabled: z.boolean(),
  // Neutral is always on: it's the fallback face.
  enabledEmotions: z
    .array(z.enum(ROBOT_EMOTIONS))
    .transform((list) => ROBOT_EMOTIONS.filter((e) => e === "neutral" || list.includes(e))),
});
