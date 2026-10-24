import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClassroomDetail } from "@/components/classroom-detail";
import { PageSkeleton } from "@/components/page-skeleton";
import { getManagedClassroom } from "@/server/queries/classrooms";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Sınıf" };

export default function AdminClassroomPage({ params }: PageProps<"/admin/siniflar/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Classroom params={params} />
    </Suspense>
  );
}

async function Classroom({ params }: Pick<PageProps<"/admin/siniflar/[id]">, "params">) {
  await requireRole("admin");
  const { id } = await params;
  return (
    <div className="grid gap-6">
      <Link href="/admin/siniflar" className="text-sm text-muted-foreground hover:underline">
        ← Sınıflar
      </Link>
      <ClassroomDetail {...await getManagedClassroom(id)} />
    </div>
  );
}
