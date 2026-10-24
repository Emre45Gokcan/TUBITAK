/** Fallback while a page's session check and data stream in. */
export function PageSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Yükleniyor">
      <div className="grid gap-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-8 animate-pulse rounded-md bg-muted" />
      <div className="h-8 animate-pulse rounded-md bg-muted" />
      <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
