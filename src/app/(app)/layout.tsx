import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { UserNav } from "@/components/user-nav";

const appName = process.env.APP_NAME ?? "Sınıf Platformu";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link href="/panel" className="font-heading font-semibold">
            {appName}
          </Link>
          {/* The session is read inside this boundary so the rest of the shell renders immediately. */}
          <Suspense fallback={<div className="h-8 flex-1" />}>
            <UserNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
