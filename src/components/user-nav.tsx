import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/format";
import { signOutAction } from "@/server/actions/auth";
import { type CurrentUser, getCurrentUser } from "@/server/session";

function linksFor(user: CurrentUser) {
  if (user.status !== "active") return [];
  switch (user.role) {
    case "admin":
      return [
        { href: "/admin", label: "Genel bakış" },
        { href: "/admin/kullanicilar", label: "Kullanıcılar" },
        { href: "/admin/siniflar", label: "Sınıflar" },
        { href: "/admin/robotlar", label: "Robotlar" },
      ];
    case "teacher":
      return [{ href: "/ogretmen", label: "Sınıflarım" }];
    case "student":
      return [{ href: "/ogrenci", label: "Sınıflarım" }];
  }
}

/** Header navigation; reads the session, so it renders inside a Suspense boundary. */
export async function UserNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/giris" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Giriş yap
      </Link>
    );
  }

  // Exact-match the role home so "Genel bakış" isn't highlighted on sub-pages.
  const links = linksFor(user);
  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
      <nav className="flex flex-wrap items-center gap-1" aria-label="Ana menü">
        {links.map((link) => (
          <NavLink key={link.href} href={link.href} exact={link.href === "/admin"}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/hesap" className="grid text-right text-sm leading-tight hover:underline">
          <span className="font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
        </Link>
        <form action={signOutAction}>
          <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
            <LogOutIcon aria-hidden />
            <span className="sr-only">Çıkış yap</span>
          </button>
        </form>
      </div>
    </div>
  );
}
