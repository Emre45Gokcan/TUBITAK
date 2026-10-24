import { ClockIcon, CircleXIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { homePath, requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Hesap durumu" };

export default function PendingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountStatus />
    </Suspense>
  );
}

async function AccountStatus() {
  const user = await requireUser();
  if (user.status === "active") redirect(homePath(user));

  if (user.status === "rejected") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CircleXIcon className="mb-2 size-6 text-destructive" aria-hidden />
          <CardTitle>Öğretmen başvurunuz onaylanmadı</CardTitle>
          <CardDescription>
            Bir hata olduğunu düşünüyorsanız okul yöneticinizle iletişime geçin. Yönetici hesabınızın rolünü
            değiştirebilir.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <ClockIcon className="mb-2 size-6 text-muted-foreground" aria-hidden />
        <CardTitle>Hesabınız onay bekliyor</CardTitle>
        <CardDescription>
          Öğretmen hesabınız bir yönetici tarafından onaylandığında sınıf oluşturabileceksiniz. Onaylandığında
          size e-posta ile haber vereceğiz.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
