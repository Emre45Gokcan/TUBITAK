import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { homePath, requireUser } from "@/server/session";

/** Single post-login entry point: sends each user to the home for their role and status. */
export default function PanelPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RedirectHome />
    </Suspense>
  );
}

async function RedirectHome(): Promise<null> {
  const user = await requireUser();
  redirect(homePath(user));
}
