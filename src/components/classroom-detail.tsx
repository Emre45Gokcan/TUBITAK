import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/action-button";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  regenerateJoinCodeAction,
  removeStudentAction,
  setArchivedAction,
  setJoinEnabledAction,
} from "@/server/actions/classrooms";
import type { getManagedClassroom } from "@/server/queries/classrooms";

type Props = Awaited<ReturnType<typeof getManagedClassroom>>;

/** Classroom management view shared by the owning teacher and admins. */
export function ClassroomDetail({ viewer, classroom: c, students }: Props) {
  const isOwner = viewer.role === "teacher" && viewer.id === c.teacherId;
  const archived = Boolean(c.archivedAt);
  const fields = { classroomId: c.id };

  return (
    <div className="grid gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {c.name}
            {archived && <Badge variant="secondary">Arşivlendi</Badge>}
            {!archived && !c.joinEnabled && <Badge variant="secondary">Katılıma kapalı</Badge>}
          </span>
        }
        description={
          viewer.role === "admin"
            ? `Öğretmen: ${c.teacherName} (${c.teacherEmail}) · Oluşturulma: ${formatDate(c.createdAt)}`
            : `Oluşturulma: ${formatDate(c.createdAt)}`
        }
        actions={
          <>
            {isOwner && (
              <Link href={`/ogretmen/siniflar/${c.id}/duzenle`} className={buttonVariants({ variant: "outline" })}>
                <PencilIcon aria-hidden />
                Düzenle
              </Link>
            )}
            {archived ? (
              <ActionButton action={setArchivedAction} fields={{ ...fields, archived: "false" }} variant="outline">
                Arşivden çıkar
              </ActionButton>
            ) : (
              <ActionButton
                action={setArchivedAction}
                fields={{ ...fields, archived: "true" }}
                variant="outline"
                confirm={{
                  title: "Sınıf arşivlensin mi?",
                  description:
                    "Arşivlenen sınıfa yeni öğrenci katılamaz. Kayıtlı öğrenciler sınıfı görmeye devam eder. Daha sonra arşivden çıkarabilirsiniz.",
                  confirmLabel: "Arşivle",
                }}
              >
                Arşivle
              </ActionButton>
            )}
          </>
        }
      />

      {c.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{c.description}</p>}

      {!archived && (
        <Card>
          <CardHeader>
            <CardTitle>Katılım kodu</CardTitle>
            <CardDescription>
              {c.joinEnabled
                ? "Öğrenciler bu kodu girerek sınıfa katılır."
                : "Sınıf yeni katılımlara kapalı; kod şu an çalışmıyor."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-lg bg-muted px-4 py-2 font-mono text-3xl font-semibold tracking-[0.3em]"
              aria-label={`Katılım kodu: ${c.joinCode.split("").join(" ")}`}
            >
              {c.joinCode}
            </span>
            <CopyButton value={c.joinCode} />
            {isOwner && (
              <>
                <ActionButton
                  action={regenerateJoinCodeAction}
                  fields={fields}
                  variant="outline"
                  size="sm"
                  confirm={{
                    title: "Yeni kod oluşturulsun mu?",
                    description: "Eski kod hemen geçersiz olur. Zaten kayıtlı öğrenciler etkilenmez.",
                    confirmLabel: "Yeni kod oluştur",
                  }}
                >
                  Yeni kod
                </ActionButton>
                <ActionButton
                  action={setJoinEnabledAction}
                  fields={{ ...fields, joinEnabled: String(!c.joinEnabled) }}
                  variant="outline"
                  size="sm"
                >
                  {c.joinEnabled ? "Katılımı kapat" : "Katılımı aç"}
                </ActionButton>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Öğrenciler ({students.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu sınıfa henüz katılan öğrenci yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad soyad</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Katılma tarihi</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">İşlemler</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {viewer.role === "admin" ? (
                          <Link href={`/admin/kullanicilar/${s.id}`} className="hover:underline">
                            {s.name}
                          </Link>
                        ) : (
                          s.name
                        )}
                      </TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>{formatDate(s.enrolledAt)}</TableCell>
                      <TableCell className="text-right">
                        <ActionButton
                          action={removeStudentAction}
                          fields={{ ...fields, studentId: s.id }}
                          variant="destructive"
                          size="sm"
                          confirm={{
                            title: "Öğrenci sınıftan çıkarılsın mı?",
                            description: `${s.name} bu sınıftan çıkarılacak. Öğrenci katılım koduyla tekrar katılabilir.`,
                            confirmLabel: "Çıkar",
                          }}
                        >
                          Çıkar
                        </ActionButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
