import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listAllClassrooms } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Sınıflar" };

export default function AdminClassroomsPage({ searchParams }: PageProps<"/admin/siniflar">) {
  return (
    <div className="grid gap-6">
      <PageHeader title="Sınıflar" description="Platformdaki tüm sınıflar." />
      <Suspense fallback={<PageSkeleton />}>
        <Classrooms searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Classrooms({ searchParams }: Pick<PageProps<"/admin/siniflar">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const { rows, total, page, pageCount } = await listAllClassrooms({
    q,
    page: typeof sp.sayfa === "string" ? sp.sayfa : undefined,
  });

  return (
    <>
      <form className="flex flex-wrap gap-2" role="search">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Sınıf veya öğretmen adı"
          aria-label="Sınıf veya öğretmen adıyla ara"
          className="w-64 max-w-full"
        />
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>
      <Card>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">{total} sınıf</p>
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sınıf</TableHead>
                    <TableHead>Öğretmen</TableHead>
                    <TableHead>Öğrenci</TableHead>
                    <TableHead>Kod</TableHead>
                    <TableHead>Oluşturulma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/siniflar/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                        {c.archivedAt && (
                          <Badge variant="secondary" className="ml-2">
                            Arşivlendi
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{c.teacherName}</TableCell>
                      <TableCell className="tabular-nums">{c.studentCount}</TableCell>
                      <TableCell className="font-mono">{c.joinCode}</TableCell>
                      <TableCell>{formatDate(c.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination basePath="/admin/siniflar" params={{ q }} page={page} pageCount={pageCount} />
        </CardContent>
      </Card>
    </>
  );
}
