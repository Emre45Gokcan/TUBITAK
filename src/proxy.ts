import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic check only: no session cookie means "not signed in", so skip
 * rendering and go to the sign-in page. The real checks (valid session, role,
 * status, ownership) happen on the server in src/server/session.ts and the
 * query/action functions.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/giris", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/beklemede/:path*",
    "/hesap/:path*",
    "/admin/:path*",
    "/ogretmen/:path*",
    "/ogrenci/:path*",
  ],
};
