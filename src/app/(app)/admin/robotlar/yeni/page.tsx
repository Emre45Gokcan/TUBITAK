import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { FormSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/server/session";
import { CreateRobotForm } from "../robot-forms";

export const metadata: Metadata = { title: "Yeni robot" };

export default function NewRobotPage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <Link href="/admin/robotlar" className="text-sm text-muted-foreground hover:underline">
        ← Robotlar
      </Link>
      <PageHeader
        title="Yeni robot"
        description="Robot için bir cihaz kimliği ve gizli anahtar oluşturulur. Model, kişilik ve sesi sonra ayarlayabilirsiniz."
      />
      <Card>
        <CardContent>
          <Suspense fallback={<FormSkeleton />}>
            <NewRobot />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function NewRobot() {
  await requireRole("admin");
  return <CreateRobotForm />;
}
