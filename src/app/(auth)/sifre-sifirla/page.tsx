import { CircleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Yeni şifre belirle" };

/** Better Auth redirects here from the reset link with `?token=` (or `?error=`). */
export default function ResetPasswordPage({ searchParams }: PageProps<"/sifre-sifirla">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni şifre belirle</CardTitle>
        <CardDescription>Hesabınız için yeni bir şifre seçin.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FormSkeleton />}>
          <Reset searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function Reset({ searchParams }: Pick<PageProps<"/sifre-sifirla">, "searchParams">) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string" || !token) {
    return (
      <div className="grid gap-4">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.</AlertDescription>
        </Alert>
        <Link href="/sifremi-unuttum" className={buttonVariants()}>
          Yeni bağlantı iste
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
