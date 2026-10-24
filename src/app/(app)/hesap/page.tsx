import type { Metadata } from "next";
import { Suspense } from "react";
import { RoleBadge, StatusBadge } from "@/components/badges";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/server/actions/auth";
import { requireUser } from "@/server/session";
import { NameForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Hesabım" };

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await requireUser();
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Hesabım"
        description={user.email}
        actions={
          <>
            <RoleBadge role={user.role} />
            {user.status !== "active" && <StatusBadge status={user.status} />}
          </>
        }
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Adınız öğretmenlerinize ve öğrencilerinize bu şekilde görünür.</CardDescription>
          </CardHeader>
          <CardContent>
            <NameForm name={user.name} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Şifre</CardTitle>
            <CardDescription>Şifrenizi değiştirdiğinizde diğer cihazlardaki oturumlar kapatılır.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          Çıkış yap
        </Button>
      </form>
    </div>
  );
}
