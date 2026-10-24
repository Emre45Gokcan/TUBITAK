import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { RobotStatusBadge } from "@/components/robot-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAgo, formatDateTime } from "@/lib/format";
import { EMOTION_LABELS } from "@/lib/robot-config";
import { cn } from "@/lib/utils";
import { clearRobotHistoryAction, deleteRobotAction, setRobotActiveAction } from "@/server/actions/robots";
import { getRobotForAdmin } from "@/server/queries/robots";
import { RobotConfigForm, RotateTokenForm } from "../robot-forms";

export const metadata: Metadata = { title: "Robot" };

export default function RobotPage({ params }: PageProps<"/admin/robotlar/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RobotDetail params={params} />
    </Suspense>
  );
}

async function RobotDetail({ params }: Pick<PageProps<"/admin/robotlar/[id]">, "params">) {
  const { id } = await params;
  const { robot, messages } = await getRobotForAdmin(id);
  const fields = { robotId: robot.id };
  const deactivated = Boolean(robot.deactivatedAt);

  return (
    <div className="grid gap-6">
      <Link href="/admin/robotlar" className="text-sm text-muted-foreground hover:underline">
        ← Robotlar
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {robot.name}
            <RobotStatusBadge online={robot.online} deactivated={deactivated} />
          </span>
        }
        description={<span className="font-mono">{robot.deviceId}</span>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Yapılandırma</CardTitle>
            <CardDescription>Değişiklikler robotun bir sonraki konuşmasında geçerli olur.</CardDescription>
          </CardHeader>
          <CardContent>
            <RobotConfigForm
              robot={{
                id: robot.id,
                name: robot.name,
                model: robot.model,
                personality: robot.personality,
                voice: robot.voice,
                memoryEnabled: robot.memoryEnabled,
                enabledEmotions: robot.enabledEmotions,
              }}
            />
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Bağlantı</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
                <dt>Son görülme</dt>
                <dd className="text-foreground">
                  {formatAgo(robot.secondsSinceSeen)}
                  {robot.lastSeenAt && (
                    <span className="block text-xs text-muted-foreground">{formatDateTime(robot.lastSeenAt)}</span>
                  )}
                </dd>
                <dt>Anahtar</dt>
                <dd className="text-foreground">
                  <span className="font-mono">{robot.tokenHint}…</span>
                  <span className="block text-xs text-muted-foreground">
                    Oluşturulma: {formatDateTime(robot.tokenCreatedAt)}
                  </span>
                </dd>
              </dl>
              <RotateTokenForm robotId={robot.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Robotu yönet</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {deactivated ? (
                <ActionButton action={setRobotActiveAction} fields={{ ...fields, active: "true" }} variant="outline">
                  Yeniden etkinleştir
                </ActionButton>
              ) : (
                <ActionButton
                  action={setRobotActiveAction}
                  fields={{ ...fields, active: "false" }}
                  variant="outline"
                  confirm={{
                    title: "Robot devre dışı bırakılsın mı?",
                    description: "Robotun anahtarı reddedilir ve robot sunucuya bağlanamaz. Ayarlar ve geçmiş korunur.",
                    confirmLabel: "Devre dışı bırak",
                  }}
                >
                  Devre dışı bırak
                </ActionButton>
              )}
              <ActionButton
                action={deleteRobotAction}
                fields={fields}
                variant="destructive"
                confirm={{
                  title: "Robot silinsin mi?",
                  description: "Robot, ayarları ve tüm konuşma geçmişi kalıcı olarak silinir. Bu işlem geri alınamaz.",
                  confirmLabel: "Robotu sil",
                }}
              >
                Sil
              </ActionButton>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Konuşma geçmişi</CardTitle>
          <CardDescription>
            {robot.memoryEnabled
              ? "Son 50 mesaj. Robot yanıt verirken son 20 mesajı hatırlar."
              : "Konuşma geçmişi kapalı: yeni konuşmalar kaydedilmiyor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kaydedilmiş konuşma yok.</p>
          ) : (
            <>
              <ol className="grid gap-3">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "grid max-w-[85%] gap-1 rounded-xl px-3 py-2 text-sm",
                      m.role === "user" ? "justify-self-end bg-muted" : "justify-self-start ring-1 ring-foreground/10",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {m.role === "user" ? "Kullanıcı" : "Robot"} · {formatDateTime(m.createdAt)}
                      {m.emotion && <Badge variant="secondary">{EMOTION_LABELS[m.emotion]}</Badge>}
                    </span>
                    <span className="whitespace-pre-line">{m.content}</span>
                  </li>
                ))}
              </ol>
              <div>
                <ActionButton
                  action={clearRobotHistoryAction}
                  fields={fields}
                  variant="outline"
                  size="sm"
                  confirm={{
                    title: "Konuşma geçmişi silinsin mi?",
                    description: "Robot önceki konuşmaları hatırlamaz. Bu işlem geri alınamaz.",
                    confirmLabel: "Geçmişi sil",
                  }}
                >
                  Geçmişi temizle
                </ActionButton>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
