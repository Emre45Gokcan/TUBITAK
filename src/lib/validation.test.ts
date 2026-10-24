import { describe, expect, it } from "vitest";
import { classroomSchema, joinCodeSchema, signInSchema, signUpSchema } from "./validation";

const validSignUp = {
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  password: "guclu-sifre",
  confirmPassword: "guclu-sifre",
  accountType: "teacher",
};

describe("signUpSchema", () => {
  it("accepts student and teacher sign-ups", () => {
    expect(signUpSchema.safeParse(validSignUp).success).toBe(true);
    expect(signUpSchema.safeParse({ ...validSignUp, accountType: "student" }).success).toBe(true);
  });

  it("never accepts admin as a self-chosen account type", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, accountType: "admin" }).success).toBe(false);
  });

  it("normalizes email", () => {
    const parsed = signUpSchema.parse({ ...validSignUp, email: "  Ayse@Example.COM " });
    expect(parsed.email).toBe("ayse@example.com");
  });

  it("reports mismatched passwords on confirmPassword in Turkish", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: "baska" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "Şifreler eşleşmiyor.",
    });
  });

  it("requires 8+ character passwords", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: "kisa", confirmPassword: "kisa" });
    expect(result.error?.issues.map((i) => i.message)).toContain("Şifre en az 8 karakter olmalı.");
  });
});

describe("signInSchema", () => {
  it("rejects invalid email with a Turkish message", () => {
    const result = signInSchema.safeParse({ email: "gecersiz", password: "x" });
    expect(result.error?.issues[0]?.message).toBe("Geçerli bir e-posta adresi girin.");
  });
});

describe("classroomSchema", () => {
  it("trims name and turns an empty description into null", () => {
    expect(classroomSchema.parse({ name: "  9-A Matematik ", description: "   " })).toEqual({
      name: "9-A Matematik",
      description: null,
    });
  });
});

describe("joinCodeSchema", () => {
  it("normalizes before validating", () => {
    expect(joinCodeSchema.parse({ code: "abc-2def" }).code).toBe("ABC2DEF");
    expect(joinCodeSchema.safeParse({ code: "ABC" }).success).toBe(false);
  });
});
