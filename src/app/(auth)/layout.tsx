import Link from "next/link";
import type { ReactNode } from "react";

const appName = process.env.APP_NAME ?? "Sınıf Platformu";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Link href="/" className="text-center font-heading text-lg font-semibold">
        {appName}
      </Link>
      {children}
    </main>
  );
}
