import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { RobotStatusBadge } from "@/components/robot-status";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAgo } from "@/lib/format";
import { ROBOT_PROVIDER_LABEL, robotModelLabel } from "@/lib/robot-config";
import { setRobotActiveAction } from "@/server/actions/robots";
import { listRobots } from "@/server/queries/robots";

export const metadata: Metadata = { title: "Robotlar" };

export default function RobotsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Robotlar"
        description="Raspberry Pi yardımcı robotları. Robotlar sunucuya kendileri bağlanır; ağ ayarı gerekmez."
        actions={
          <Link href="/admin/robotlar/yeni" className={buttonVariants()}>
            <PlusIcon aria-hidden />
            Yeni robot
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <RobotList />
      </Suspense>
    </div>
  );
}

async function RobotList() {
  const robots = await listRobots();
  if (robots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Henüz robot yok</CardTitle>
          <CardDescription>Bir robot ekleyin; size Raspberry Pi için bir cihaz kimliği ve anahtar verilecek.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Robot</TableHead>
                <TableHead>Cihaz kimliği</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Son görülme</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">İşlemler</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {robots.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/robotlar/${r.id}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.deviceId}</TableCell>
                  <TableCell>
                    <RobotStatusBadge online={r.online} deactivated={Boolean(r.deactivatedAt)} />
                  </TableCell>
                  <TableCell>{formatAgo(r.secondsSinceSeen)}</TableCell>
                  <TableCell>
                    <span className="grid leading-tight">
                      <span>{robotModelLabel(r.model)}</span>
                      <span className="text-xs text-muted-foreground">{ROBOT_PROVIDER_LABEL}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/robotlar/${r.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Yapılandır
                      </Link>
                      {r.deactivatedAt ? (
                        <ActionButton
                          action={setRobotActiveAction}
                          fields={{ robotId: r.id, active: "true" }}
                          variant="outline"
                          size="sm"
                        >
                          Etkinleştir
                        </ActionButton>
                      ) : (
                        <ActionButton
                          action={setRobotActiveAction}
                          fields={{ robotId: r.id, active: "false" }}
                          variant="destructive"
                          size="sm"
                          confirm={{
                            title: "Robot devre dışı bırakılsın mı?",
                            description: `${r.name} artık sunucuya bağlanamaz. Daha sonra yeniden etkinleştirebilirsiniz.`,
                            confirmLabel: "Devre dışı bırak",
                          }}
                        >
                          Devre dışı bırak
                        </ActionButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
