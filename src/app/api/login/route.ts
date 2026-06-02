import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isPasswordConfigured,
  verifyDashboardPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const from = sanitizeRedirect(String(formData.get("from") ?? "/"));

  if (!isPasswordConfigured()) {
    return NextResponse.redirect(new URL("/login?error=missing-config", request.url));
  }

  const isValid = await verifyDashboardPassword(password);

  if (!isValid) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("from", from);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.redirect(new URL(from, request.url));
  response.cookies.set(AUTH_COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

function sanitizeRedirect(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/login") || value.startsWith("/api/login")) {
    return "/";
  }

  return value;
}
