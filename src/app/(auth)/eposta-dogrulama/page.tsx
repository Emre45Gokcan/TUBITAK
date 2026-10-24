import { CircleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectIfSignedIn } from "@/server/session";

export const metadata: Metadata = { title: "E-posta doğrulama" };

/** Better Auth sends users here after they open the verification link. */
export default function VerifyEmailPage({ searchParams }: PageProps<"/eposta-dogrulama">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>E-posta doğrulama</CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FormSkeleton />}>
          <VerifyResult searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function VerifyResult({ searchParams }: Pick<PageProps<"/eposta-dogrulama">, "searchParams">) {
  const { error } = await searchParams;
  if (error) {
    return (
      <div className="grid gap-4">
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>
            Doğrulama bağlantısı geçersiz veya süresi dolmuş. Giriş yapmayı deneyin; size yeni bir bağlantı
            göndereceğiz.
          </AlertDescription>
        </Alert>
        <Link href="/giris" className={buttonVariants()}>
          Giriş yap
        </Link>
      </div>
    );
  }

  // Successful verification signs the user in automatically.
  await redirectIfSignedIn();
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">E-posta adresiniz doğrulandı. Artık giriş yapabilirsiniz.</p>
      <Link href="/giris" className={buttonVariants()}>
        Giriş yap
      </Link>
    </div>
  );
}
