import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { approveTeacherAction, rejectTeacherAction } from "@/server/actions/admin";
import { getAdminOverview, listPendingTeachers } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Yönetim" };

export default function AdminHomePage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Genel bakış" description="Kullanıcılar, öğretmen onayları ve sınıflar." />
      <Suspense fallback={<PageSkeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const [overview, pending] = await Promise.all([getAdminOverview(), listPendingTeachers()]);
  const stats = [
    { label: "Öğrenci", value: overview.roleTotals.student, href: "/admin/kullanicilar?rol=student" },
    { label: "Öğretmen", value: overview.roleTotals.teacher, href: "/admin/kullanicilar?rol=teacher" },
    { label: "Yönetici", value: overview.roleTotals.admin, href: "/admin/kullanicilar?rol=admin" },
    { label: "Sınıf", value: overview.classrooms, href: "/admin/siniflar" },
  ];

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Onay bekleyen öğretmenler
            {pending.length > 0 && <Badge>{pending.length}</Badge>}
          </CardTitle>
          <CardDescription>Onaylanan öğretmenler sınıf oluşturabilir ve e-posta ile bilgilendirilir.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Onay bekleyen başvuru yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad soyad</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Başvuru</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">İşlemler</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/kullanicilar/${t.id}`} className="hover:underline">
                          {t.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-2">
                          {t.email}
                          {!t.emailVerified && <Badge variant="secondary">E-posta doğrulanmadı</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(t.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <ActionButton action={approveTeacherAction} fields={{ userId: t.id }} size="sm">
                            Onayla
                          </ActionButton>
                          <ActionButton
                            action={rejectTeacherAction}
                            fields={{ userId: t.id }}
                            size="sm"
                            variant="destructive"
                            confirm={{
                              title: "Başvuru reddedilsin mi?",
                              description: `${t.name} öğretmen olarak onaylanmayacak ve e-posta ile bilgilendirilecek. Bu kararı daha sonra kullanıcı sayfasından değiştirebilirsiniz.`,
                              confirmLabel: "Reddet",
                            }}
                          >
                            Reddet
                          </ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
