import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Şifremi unuttum</CardTitle>
        <CardDescription>
          Hesabınızın e-posta adresini girin, size şifre sıfırlama bağlantısı gönderelim.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <Link href="/giris" className="text-muted-foreground hover:underline">
          Giriş sayfasına dön
        </Link>
      </CardFooter>
    </Card>
  );
}
