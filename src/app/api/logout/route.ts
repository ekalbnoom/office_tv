import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  const response = NextResponse.redirect(new URL("/login", baseUrl));
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
