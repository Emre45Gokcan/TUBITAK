import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RoleBadge, StatusBadge } from "@/components/badges";
import { NativeSelect } from "@/components/forms/native-select";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, STATUS_LABELS, formatDate } from "@/lib/format";
import { USER_ROLES, USER_STATUSES } from "@/lib/roles";
import { listUsers } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Kullanıcılar" };

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/kullanicilar">) {
  return (
    <div className="grid gap-6">
      <PageHeader title="Kullanıcılar" description="Rol ve duruma göre filtreleyin, ad veya e-postayla arayın." />
      <Suspense fallback={<PageSkeleton />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

async function Users({ searchParams }: Pick<PageProps<"/admin/kullanicilar">, "searchParams">) {
  const sp = await searchParams;
  const filters = { q: param(sp.q), rol: param(sp.rol), durum: param(sp.durum) };
  const { rows, total, page, pageCount } = await listUsers({
    q: filters.q,
    role: filters.rol,
    status: filters.durum,
    page: param(sp.sayfa),
  });

  return (
    <>
      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="q"
          defaultValue={filters.q}
          placeholder="Ad veya e-posta"
          aria-label="Ad veya e-posta ile ara"
          className="w-64 max-w-full"
        />
        <NativeSelect name="rol" defaultValue={filters.rol ?? ""} aria-label="Rol">
          <option value="">Tüm roller</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="durum" defaultValue={filters.durum ?? ""} aria-label="Durum">
          <option value="">Tüm durumlar</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filtrele
        </Button>
      </form>

      <Card>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">{total} kullanıcı</p>
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad soyad</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Kayıt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/kullanicilar/${u.id}`} className="hover:underline">
                          {u.name}
                        </Link>
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination basePath="/admin/kullanicilar" params={filters} page={page} pageCount={pageCount} />
        </CardContent>
      </Card>
    </>
  );
}
