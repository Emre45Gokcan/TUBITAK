import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectIfSignedIn } from "@/server/session";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Kayıt ol" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kayıt ol</CardTitle>
        <CardDescription>Yeni bir hesap oluşturun. E-posta adresinizi doğrulamanız gerekecek.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FormSkeleton />}>
          <SignUp />
        </Suspense>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Zaten hesabınız var mı?&nbsp;
        <Link href="/giris" className="font-medium text-foreground hover:underline">
          Giriş yapın
        </Link>
      </CardFooter>
    </Card>
  );
}

async function SignUp() {
  await redirectIfSignedIn();
  return <SignUpForm />;
}
