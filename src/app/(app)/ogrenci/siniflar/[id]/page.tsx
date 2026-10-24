import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { leaveClassroomAction } from "@/server/actions/enrollments";
import { getMyEnrolledClassroom } from "@/server/queries/classrooms";

export const metadata: Metadata = { title: "Sınıf" };

export default function StudentClassroomPage({ params }: PageProps<"/ogrenci/siniflar/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Classroom params={params} />
    </Suspense>
  );
}

async function Classroom({ params }: Pick<PageProps<"/ogrenci/siniflar/[id]">, "params">) {
  const { id } = await params;
  const c = await getMyEnrolledClassroom(id);

  return (
    <div className="grid gap-6">
      <Link href="/ogrenci" className="text-sm text-muted-foreground hover:underline">
        ← Sınıflarım
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {c.name}
            {c.archivedAt && <Badge variant="secondary">Arşivlendi</Badge>}
          </span>
        }
        description={`Öğretmen: ${c.teacherName}`}
        actions={
          <ActionButton
            action={leaveClassroomAction}
            fields={{ classroomId: c.id }}
            variant="destructive"
            confirm={{
              title: "Sınıftan ayrılmak istiyor musunuz?",
              description: "Tekrar katılmak için öğretmeninizden katılım kodunu almanız gerekir.",
              confirmLabel: "Sınıftan ayrıl",
            }}
          >
            Sınıftan ayrıl
          </ActionButton>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Sınıf bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {c.description && <p className="whitespace-pre-line">{c.description}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
            <dt>Öğrenci sayısı</dt>
            <dd className="text-foreground">{c.studentCount}</dd>
            <dt>Katılma tarihi</dt>
            <dd className="text-foreground">{formatDate(c.enrolledAt)}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
