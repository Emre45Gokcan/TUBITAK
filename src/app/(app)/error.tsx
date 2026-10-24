"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-md gap-4 py-16 text-center">
      <h1 className="font-heading text-xl font-semibold">Bir şeyler ters gitti</h1>
      <p className="text-sm text-muted-foreground">
        Sayfa yüklenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
      </p>
      <Button onClick={reset} className="justify-self-center">
        Tekrar dene
      </Button>
    </div>
  );
}
