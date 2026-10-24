import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Prev/next links that keep the current filters in the query string. */
export function Pagination({
  basePath,
  params,
  page,
  pageCount,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    query.set("sayfa", String(target));
    return `${basePath}?${query}`;
  };
  const linkClass = (disabled: boolean) =>
    cn(buttonVariants({ variant: "outline", size: "sm" }), disabled && "pointer-events-none opacity-50");

  return (
    <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Sayfalama">
      <Link href={href(page - 1)} className={linkClass(page <= 1)} aria-disabled={page <= 1}>
        Önceki
      </Link>
      <span className="text-muted-foreground">
        Sayfa {page} / {pageCount}
      </span>
      <Link href={href(page + 1)} className={linkClass(page >= pageCount)} aria-disabled={page >= pageCount}>
        Sonraki
      </Link>
    </nav>
  );
}
