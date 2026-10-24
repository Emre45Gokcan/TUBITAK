import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { RoleBadge, StatusBadge } from "@/components/badges";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  approveTeacherAction,
  reactivateUserAction,
  rejectTeacherAction,
  suspendUserAction,
} from "@/server/actions/admin";
import { getUserForAdmin } from "@/server/queries/admin";
import { RoleForm } from "./role-form";

export const metadata: Metadata = { title: "Kullanıcı" };

export default function AdminUserPage({ params }: PageProps<"/admin/kullanicilar/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UserDetail params={params} />
    </Suspense>
  );
}

async function UserDetail({ params }: Pick<PageProps<"/admin/kullanicilar/[id]">, "params">) {
  const { id } = await params;
  const { user, isSelf, teaching, enrolled } = await getUserForAdmin(id);
  const fields = { userId: user.id };

  return (
    <div className="grid gap-6">
      <Link href="/admin/kullanicilar" className="text-sm text-muted-foreground hover:underline">
        ← Kullanıcılar
      </Link>
      <PageHeader
        title={user.name}
        description={user.email}
        actions={
          <>
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
            {!user.emailVerified && <Badge variant="secondary">E-posta doğrulanmadı</Badge>}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Hesap yönetimi</CardTitle>
          <CardDescription>
            Kayıt tarihi: {formatDate(user.createdAt)}
            {isSelf && " · Kendi hesabınızın rolünü veya durumunu değiştiremezsiniz."}
          </CardDescription>
        </CardHeader>
        {!isSelf && (
          <CardContent className="grid gap-6">
            {user.role === "teacher" && user.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <ActionButton action={approveTeacherAction} fields={fields}>
                  Öğretmen olarak onayla
                </ActionButton>
                <ActionButton
                  action={rejectTeacherAction}
                  fields={fields}
                  variant="destructive"
                  confirm={{
                    title: "Başvuru reddedilsin mi?",
                    description: `${user.name} öğretmen olarak onaylanmayacak ve e-posta ile bilgilendirilecek.`,
                    confirmLabel: "Reddet",
                  }}
                >
                  Reddet
                </ActionButton>
              </div>
            )}
            {user.role === "teacher" && user.status === "rejected" && (
              <ActionButton action={approveTeacherAction} fields={fields} variant="outline">
                Kararı değiştir ve onayla
              </ActionButton>
            )}

            <RoleForm userId={user.id} role={user.role} />

            <div className="grid gap-2">
              <p className="text-sm font-medium">Hesap durumu</p>
              {user.status === "suspended" ? (
                <ActionButton action={reactivateUserAction} fields={fields} variant="outline">
                  Hesabı yeniden etkinleştir
                </ActionButton>
              ) : (
                <div>
                  <ActionButton
                    action={suspendUserAction}
                    fields={fields}
                    variant="destructive"
                    confirm={{
                      title: "Hesap askıya alınsın mı?",
                      description: `${user.name} tüm cihazlarda oturumdan çıkarılacak ve tekrar giriş yapamayacak. Verileri silinmez.`,
                      confirmLabel: "Askıya al",
                    }}
                  >
                    Hesabı askıya al
                  </ActionButton>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {(teaching.length > 0 || user.role === "teacher") && (
        <ClassroomList title="Öğrettiği sınıflar" classrooms={teaching} empty="Henüz sınıf oluşturmamış." />
      )}
      {(enrolled.length > 0 || user.role === "student") && (
        <ClassroomList title="Kayıtlı olduğu sınıflar" classrooms={enrolled} empty="Henüz bir sınıfa katılmamış." />
      )}
    </div>
  );
}

function ClassroomList({
  title,
  classrooms,
  empty,
}: {
  title: string;
  classrooms: { id: string; name: string; archivedAt: Date | null }[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {classrooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {classrooms.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link href={`/admin/siniflar/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
                {c.archivedAt && <Badge variant="secondary">Arşivlendi</Badge>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
