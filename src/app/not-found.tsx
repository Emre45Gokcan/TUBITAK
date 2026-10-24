import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="font-heading text-2xl font-semibold">Sayfa bulunamadı</h1>
      <p className="text-muted-foreground">
        Aradığınız sayfa mevcut değil ya da bu sayfayı görüntüleme yetkiniz yok.
      </p>
      <Link href="/panel" className={buttonVariants()}>
        Panele dön
      </Link>
    </main>
  );
}
