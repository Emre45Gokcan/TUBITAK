"use client";

import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Field, FieldError } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ActionState, initialActionState } from "@/lib/action-state";
import {
  EMOTION_LABELS,
  ROBOT_EMOTIONS,
  ROBOT_MODELS,
  ROBOT_PROVIDER_LABEL,
  ROBOT_VOICES,
  type RobotEmotion,
} from "@/lib/robot-config";
import {
  type RobotCredentialsState,
  createRobotAction,
  rotateRobotTokenAction,
  updateRobotAction,
} from "@/server/actions/robots";

// window.location.origin, read without a hydration mismatch.
const subscribe = () => () => {};
function useOrigin() {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => "");
}

function copy(value: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success("Panoya kopyalandı."))
    .catch(() => toast.error("Kopyalanamadı. Metni elle seçip kopyalayın."));
}

/** Shown once, right after the token is generated. */
function CredentialsPanel({ credentials }: { credentials: NonNullable<RobotCredentialsState["credentials"]> }) {
  const origin = useOrigin();
  const env = `ROBOT_API_URL=${origin}\nROBOT_DEVICE_ID=${credentials.deviceId}\nROBOT_DEVICE_TOKEN=${credentials.token}`;
  return (
    <div className="grid gap-3">
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Anahtarı şimdi kaydedin</AlertTitle>
        <AlertDescription>
          Bu anahtar yalnızca bir kez gösterilir. Kaybederseniz robot sayfasından yeni anahtar oluşturabilirsiniz.
        </AlertDescription>
      </Alert>
      <p className="text-sm text-muted-foreground">
        Raspberry Pi üzerindeki <code className="font-mono">raspberry-pi/.env</code> dosyasına ekleyin:
      </p>
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">{env}</pre>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => copy(env)}>
          <CopyIcon aria-hidden />
          .env satırlarını kopyala
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => copy(credentials.token)}>
          <CopyIcon aria-hidden />
          Yalnızca anahtarı kopyala
        </Button>
      </div>
    </div>
  );
}

export function CreateRobotForm() {
  const [state, formAction] = useActionState(createRobotAction, initialActionState as RobotCredentialsState);

  if (state.credentials) {
    return (
      <div className="grid gap-4">
        <CredentialsPanel credentials={state.credentials} />
        <Link href={`/admin/robotlar/${state.credentials.robotId}`} className={buttonVariants({ className: "justify-self-start" })}>
          Robotu yapılandır
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <Field
        label="Robot adı"
        name="name"
        required
        maxLength={80}
        placeholder="ör. Companion 01"
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
      <SubmitButton className="justify-self-start">Robotu oluştur</SubmitButton>
    </form>
  );
}

export function RotateTokenForm({ robotId }: { robotId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: RobotCredentialsState, formData: FormData) => {
    const result = await rotateRobotTokenAction(prev, formData);
    if (result.error) toast.error(result.error);
    setOpen(false);
    return result;
  }, initialActionState as RobotCredentialsState);

  if (state.credentials) return <CredentialsPanel credentials={state.credentials} />;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="justify-self-start" />}>Yeni anahtar oluştur</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni anahtar oluşturulsun mu?</DialogTitle>
          <DialogDescription>
            Eski anahtar hemen geçersiz olur. Robotun .env dosyasındaki ROBOT_DEVICE_TOKEN değerini güncellemeniz gerekir.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
          <form action={formAction}>
            <input type="hidden" name="robotId" value={robotId} />
            <SubmitButton>Yeni anahtar oluştur</SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RobotConfig = {
  id: string;
  name: string;
  model: string;
  personality: string;
  voice: string;
  memoryEnabled: boolean;
  enabledEmotions: RobotEmotion[];
};

export function RobotConfigForm({ robot }: { robot: RobotConfig }) {
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await updateRobotAction(robot.id, prev, formData);
      if (result.success) toast.success(result.success);
      return result;
    },
    initialActionState,
  );
  const v = state.values;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state.error && <FormAlert state={state} />}
      <Field
        label="Robot adı"
        name="name"
        required
        maxLength={80}
        defaultValue={v?.name ?? robot.name}
        errors={state.fieldErrors?.name}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="model">Yapay zekâ modeli</Label>
        <NativeSelect id="model" name="model" defaultValue={v?.model ?? robot.model} className="max-w-sm">
          {ROBOT_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">Sağlayıcı: {ROBOT_PROVIDER_LABEL}</p>
        <FieldError id="model-error" errors={state.fieldErrors?.model} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="personality">Kişilik (sistem talimatı)</Label>
        <Textarea
          id="personality"
          name="personality"
          rows={5}
          maxLength={2000}
          defaultValue={v?.personality ?? robot.personality}
          aria-invalid={state.fieldErrors?.personality ? true : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Robotun nasıl konuşacağını anlatın. Kısa, sesli okunabilir yanıtlar ve yüz ifadesi kuralları otomatik eklenir.
        </p>
        <FieldError id="personality-error" errors={state.fieldErrors?.personality} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="voice">Ses</Label>
        <NativeSelect id="voice" name="voice" defaultValue={v?.voice ?? robot.voice} className="max-w-48">
          {ROBOT_VOICES.map((voice) => (
            <option key={voice} value={voice}>
              {voice}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">OpenAI metin okuma sesi.</p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="memoryEnabled"
          defaultChecked={robot.memoryEnabled}
          className="mt-0.5 accent-primary"
        />
        <span className="grid gap-0.5">
          <span className="font-medium">Konuşma geçmişini sakla</span>
          <span className="text-xs text-muted-foreground">
            Açıkken robot son 20 mesajı hatırlar ve geçmiş bu sayfada görünür. Kapalıyken hiçbir konuşma kaydedilmez.
          </span>
        </span>
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Yüz ifadeleri</legend>
        <div className="flex flex-wrap gap-4">
          {ROBOT_EMOTIONS.map((emotion) => (
            <label key={emotion} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabledEmotions"
                value={emotion}
                defaultChecked={emotion === "neutral" || robot.enabledEmotions.includes(emotion)}
                disabled={emotion === "neutral"}
                className="accent-primary"
              />
              {EMOTION_LABELS[emotion]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Nötr her zaman açıktır; kapalı ifadeler yerine nötr gösterilir.</p>
      </fieldset>

      <SubmitButton className="justify-self-start">Kaydet</SubmitButton>
    </form>
  );
}
