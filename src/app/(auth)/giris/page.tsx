import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectIfSignedIn } from "@/server/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Giriş yap" };

export default function SignInPage({ searchParams }: PageProps<"/giris">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Giriş yap</CardTitle>
        <CardDescription>Hesabınıza e-posta adresiniz ve şifrenizle giriş yapın.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FormSkeleton />}>
          <SignIn searchParams={searchParams} />
        </Suspense>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Hesabınız yok mu?&nbsp;
        <Link href="/kayit" className="font-medium text-foreground hover:underline">
          Kayıt olun
        </Link>
      </CardFooter>
    </Card>
  );
}

async function SignIn({ searchParams }: Pick<PageProps<"/giris">, "searchParams">) {
  await redirectIfSignedIn();
  const { sifre } = await searchParams;
  return (
    <div className="grid gap-4">
      {sifre === "yenilendi" && (
        <Alert>
          <CircleCheckIcon />
          <AlertDescription>Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz.</AlertDescription>
        </Alert>
      )}
      <SignInForm />
    </div>
  );
}
