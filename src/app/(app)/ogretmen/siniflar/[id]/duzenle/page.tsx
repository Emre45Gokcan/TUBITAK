import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { updateClassroomAction } from "@/server/actions/classrooms";
import { getManagedClassroom } from "@/server/queries/classrooms";
import { ClassroomForm } from "../../classroom-form";

export const metadata: Metadata = { title: "Sınıfı düzenle" };

export default function EditClassroomPage({ params }: PageProps<"/ogretmen/siniflar/[id]/duzenle">) {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageHeader title="Sınıfı düzenle" />
      <Card>
        <CardContent>
          <Suspense fallback={<FormSkeleton />}>
            <EditClassroom params={params} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function EditClassroom({ params }: Pick<PageProps<"/ogretmen/siniflar/[id]/duzenle">, "params">) {
  const { id } = await params;
  const { viewer, classroom } = await getManagedClassroom(id);
  // Only the owning teacher edits (admins can view and archive, not edit).
  if (viewer.role !== "teacher") notFound();

  return (
    <ClassroomForm
      action={updateClassroomAction.bind(null, classroom.id)}
      defaults={{ name: classroom.name, description: classroom.description }}
      submitLabel="Kaydet"
      cancelHref={`/ogretmen/siniflar/${classroom.id}`}
    />
  );
}
