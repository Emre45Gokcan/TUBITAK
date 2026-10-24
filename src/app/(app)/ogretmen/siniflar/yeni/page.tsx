import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { createClassroomAction } from "@/server/actions/classrooms";
import { requireRole } from "@/server/session";
import { ClassroomForm } from "../classroom-form";

export const metadata: Metadata = { title: "Yeni sınıf" };

export default function NewClassroomPage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageHeader title="Yeni sınıf" description="Sınıf oluşturulunca size bir katılım kodu verilir." />
      <Card>
        <CardContent>
          <Suspense fallback={<FormSkeleton />}>
            <NewClassroom />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function NewClassroom() {
  await requireRole("teacher");
  return <ClassroomForm action={createClassroomAction} submitLabel="Sınıfı oluştur" cancelHref="/ogretmen" />;
}
