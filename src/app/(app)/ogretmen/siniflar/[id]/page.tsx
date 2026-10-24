import type { Metadata } from "next";
import { Suspense } from "react";
import { ClassroomDetail } from "@/components/classroom-detail";
import { PageSkeleton } from "@/components/page-skeleton";
import { getManagedClassroom } from "@/server/queries/classrooms";

export const metadata: Metadata = { title: "Sınıf" };

export default function TeacherClassroomPage({ params }: PageProps<"/ogretmen/siniflar/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Classroom params={params} />
    </Suspense>
  );
}

async function Classroom({ params }: Pick<PageProps<"/ogretmen/siniflar/[id]">, "params">) {
  const { id } = await params;
  return <ClassroomDetail {...await getManagedClassroom(id)} />;
}
