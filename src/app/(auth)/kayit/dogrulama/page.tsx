import { MailCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "E-postanızı kontrol edin" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <MailCheckIcon className="mb-2 size-6 text-muted-foreground" aria-hidden />
        <CardTitle>E-postanızı kontrol edin</CardTitle>
        <CardDescription>
          Hesabınızı etkinleştirmek için size bir doğrulama bağlantısı gönderdik. Bağlantı 1 saat geçerlidir.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-muted-foreground">
        <p>
          E-posta gelmediyse istenmeyen (spam) klasörünü kontrol edin. Ayrıca giriş yapmayı deneyebilirsiniz:
          hesabınız doğrulanmamışsa size otomatik olarak yeni bir bağlantı gönderilir.
        </p>
        <Link href="/giris" className={buttonVariants({ variant: "outline" })}>
          Giriş sayfasına git
        </Link>
      </CardContent>
    </Card>
  );
}
