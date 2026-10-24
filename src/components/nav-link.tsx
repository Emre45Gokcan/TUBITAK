"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-muted font-medium text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
