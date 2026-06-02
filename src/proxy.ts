import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isSessionCookieValid } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = await isSessionCookieValid(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login" && hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
