import { PlusIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyTeachingClassrooms } from "@/server/queries/classrooms";

export const metadata: Metadata = { title: "Sınıflarım" };

export default function TeacherHomePage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sınıflarım"
        description="Oluşturduğunuz sınıflar ve katılım kodları."
        actions={
          <Link href="/ogretmen/siniflar/yeni" className={buttonVariants()}>
            <PlusIcon aria-hidden />
            Yeni sınıf
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <ClassroomList />
      </Suspense>
    </div>
  );
}

async function ClassroomList() {
  const classrooms = await listMyTeachingClassrooms();

  if (classrooms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Henüz sınıfınız yok</CardTitle>
          <CardDescription>
            İlk sınıfınızı oluşturun ve katılım kodunu öğrencilerinizle paylaşın.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {classrooms.map((c) => (
        <li key={c.id}>
          <Link href={`/ogretmen/siniflar/${c.id}`} className="block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
                {c.description && <CardDescription className="line-clamp-2">{c.description}</CardDescription>}
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="size-4" aria-hidden />
                  {c.studentCount} öğrenci
                </span>
                {c.archivedAt ? (
                  <Badge variant="secondary">Arşivlendi</Badge>
                ) : (
                  <Badge variant="outline" className="font-mono">
                    {c.joinCode}
                  </Badge>
                )}
                {!c.archivedAt && !c.joinEnabled && <Badge variant="secondary">Katılıma kapalı</Badge>}
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
