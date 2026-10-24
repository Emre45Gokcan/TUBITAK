import { GraduationCapIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const appName = process.env.APP_NAME ?? "Sınıf Platformu";

const features = [
  {
    icon: GraduationCapIcon,
    title: "Öğretmenler sınıf oluşturur",
    text: "Her sınıfın öğrencilerle paylaşabileceğiniz kendi katılım kodu vardır.",
  },
  {
    icon: KeyRoundIcon,
    title: "Öğrenciler kodla katılır",
    text: "Öğretmeninizin verdiği 7 haneli kodu girin, sınıfa anında katılın.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Güvenli hesaplar",
    text: "E-posta doğrulaması ve yönetici onayıyla yalnızca doğru kişiler öğretmen olur.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-12 px-4 py-16">
      <section className="grid gap-6 text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{appName}</h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Öğretmenler ve öğrenciler için sade bir sınıf yönetim platformu.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/kayit" className={buttonVariants({ size: "lg" })}>
            Kayıt ol
          </Link>
          <Link href="/giris" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Giriş yap
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="grid gap-2 rounded-xl p-4 ring-1 ring-foreground/10">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
            <h2 className="font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
