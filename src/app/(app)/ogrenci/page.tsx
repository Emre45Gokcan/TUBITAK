import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { listMyEnrolledClassrooms } from "@/server/queries/classrooms";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Sınıflarım" };

export default function StudentHomePage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Sınıflarım" description="Katıldığınız sınıflar." />
      <Suspense fallback={<PageSkeleton />}>
        <StudentHome />
      </Suspense>
    </div>
  );
}

async function StudentHome() {
  const classrooms = await listMyEnrolledClassrooms();
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sınıfa katıl</CardTitle>
          <CardDescription>Öğretmeninizin paylaştığı 7 haneli kodu girin.</CardDescription>
        </CardHeader>
        <CardContent>
          <JoinForm />
        </CardContent>
      </Card>

      {classrooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz bir sınıfa katılmadınız.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((c) => (
            <li key={c.id}>
              <Link
                href={`/ogrenci/siniflar/${c.id}`}
                className="block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {c.name}
                      {c.archivedAt && <Badge variant="secondary">Arşivlendi</Badge>}
                    </CardTitle>
                    <CardDescription>Öğretmen: {c.teacherName}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto text-xs text-muted-foreground">
                    Katılma: {formatDate(c.enrolledAt)}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
